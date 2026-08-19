export const TERMINAL_PORT = 8080;
export const TERMINAL_COMMAND_TIMEOUT_SECONDS = 10 * 60;
export const TERMINAL_IDLE_TIMEOUT_SECONDS = 3 * 60 * 60;

export const TERMINAL_BRIDGE_SOURCE = String.raw`
import asyncio
import base64
import fcntl
import json
import os
import pty
import signal
import struct
import termios
import time

from websockets.asyncio.server import serve


PORT = int(os.environ.get("LEETML_TERMINAL_PORT", "8080"))
EXPECTED_SESSION = os.environ["LEETML_SESSION_ID"]
COMMAND_TIMEOUT = float(os.environ.get("LEETML_COMMAND_TIMEOUT_SECONDS", "600"))
IDLE_TIMEOUT = float(os.environ.get("LEETML_IDLE_TIMEOUT_SECONDS", "10800"))
WORKDIR = "/workspace"
ACTIVITY_PATH = os.path.join(WORKDIR, ".leetml-activity")
MAX_INPUT_BYTES = 64 * 1024
IDLE_MARKER = b"\x1b]1337;leetml-idle\x07"

active_websocket = None
active_shell = None
connection_lock = asyncio.Lock()
last_activity = time.monotonic()
last_external_activity = 0
shutdown_event = asyncio.Event()


def touch():
    global last_activity
    last_activity = time.monotonic()


def observe_external_activity():
    global last_activity, last_external_activity
    try:
        modified = os.stat(ACTIVITY_PATH).st_mtime_ns
    except OSError:
        return
    if modified > last_external_activity:
        last_external_activity = modified
        last_activity = time.monotonic()


def encode_message(message_type, **values):
    return json.dumps({"type": message_type, **values}, separators=(",", ":"))


def set_window_size(fd, cols, rows):
    size = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, size)


def spawn_shell():
    pid, master_fd = pty.fork()
    if pid == 0:
        os.chdir(WORKDIR)
        environment = os.environ.copy()
        environment.update({
            "HOME": WORKDIR,
            "TERM": "xterm-256color",
            "COLORTERM": "truecolor",
            "PROMPT_COMMAND": r"printf '\033]1337;leetml-idle\007'",
            "PS1": r"\[\033[1;32m\]ray@leetml\[\033[0m\]:\[\033[1;34m\]\w\[\033[0m\]\$ ",
        })
        os.execvpe("/bin/bash", ["/bin/bash", "--noprofile", "--norc", "-i"], environment)

    os.set_blocking(master_fd, False)
    set_window_size(master_fd, 100, 30)
    return {
        "pid": pid,
        "fd": master_fd,
        "closed": False,
        "busy": False,
        "busy_started": None,
        "output_buffer": b"",
    }


def foreground_process_group(shell):
    try:
        return os.tcgetpgrp(shell["fd"])
    except OSError:
        return None


def stop_process_group(process_group, sig):
    if process_group is None or process_group <= 0:
        return
    try:
        os.killpg(process_group, sig)
    except ProcessLookupError:
        pass


def descendant_pids(root_pid):
    parents = {}
    try:
        entries = os.listdir("/proc")
    except OSError:
        return []

    for entry in entries:
        if not entry.isdigit():
            continue
        try:
            with open(f"/proc/{entry}/stat", encoding="utf-8") as stat_file:
                stat = stat_file.read()
            fields = stat.rsplit(")", 1)[1].split()
            parents[int(entry)] = int(fields[1])
        except (OSError, ValueError, IndexError):
            continue

    descendants = []
    frontier = [root_pid]
    while frontier:
        parent = frontier.pop()
        children = [pid for pid, parent_pid in parents.items() if parent_pid == parent]
        descendants.extend(children)
        frontier.extend(children)
    return descendants


def stop_descendants(shell, sig):
    for pid in reversed(descendant_pids(shell["pid"])):
        try:
            os.kill(pid, sig)
        except ProcessLookupError:
            pass


def stop_shell(shell):
    if not shell or shell["closed"]:
        return
    shell["closed"] = True
    foreground_group = foreground_process_group(shell)
    if foreground_group != shell["pid"]:
        stop_process_group(foreground_group, signal.SIGTERM)
    stop_descendants(shell, signal.SIGTERM)
    stop_process_group(shell["pid"], signal.SIGTERM)
    try:
        os.close(shell["fd"])
    except OSError:
        pass
    try:
        os.waitpid(shell["pid"], os.WNOHANG)
    except ChildProcessError:
        pass


async def wait_until_readable(fd):
    loop = asyncio.get_running_loop()
    ready = loop.create_future()

    def mark_ready():
        if not ready.done():
            ready.set_result(None)

    loop.add_reader(fd, mark_ready)
    try:
        await ready
    finally:
        loop.remove_reader(fd)


async def send_message(websocket, send_lock, message_type, **values):
    async with send_lock:
        await websocket.send(encode_message(message_type, **values))


async def send_output(websocket, send_lock, data):
    if not data:
        return
    await send_message(
        websocket,
        send_lock,
        "output",
        data=base64.b64encode(data).decode("ascii"),
    )


def partial_marker_length(data):
    maximum = min(len(data), len(IDLE_MARKER) - 1)
    for length in range(maximum, 0, -1):
        if data.endswith(IDLE_MARKER[:length]):
            return length
    return 0


async def relay_output(websocket, shell, send_lock):
    while not shell["closed"]:
        try:
            await wait_until_readable(shell["fd"])
            data = os.read(shell["fd"], 16 * 1024)
        except BlockingIOError:
            continue
        except OSError:
            break

        if not data:
            break

        touch()
        shell["output_buffer"] += data

        while IDLE_MARKER in shell["output_buffer"]:
            before, _, after = shell["output_buffer"].partition(IDLE_MARKER)
            await send_output(websocket, send_lock, before)
            shell["output_buffer"] = after
            shell["busy"] = False
            shell["busy_started"] = None
            await send_message(websocket, send_lock, "state", state="idle")

        retained = partial_marker_length(shell["output_buffer"])
        if retained:
            ready_output = shell["output_buffer"][:-retained]
            shell["output_buffer"] = shell["output_buffer"][-retained:]
        else:
            ready_output = shell["output_buffer"]
            shell["output_buffer"] = b""
        await send_output(websocket, send_lock, ready_output)

    await send_output(websocket, send_lock, shell["output_buffer"])
    shell["output_buffer"] = b""
    if not shell["closed"]:
        await websocket.close(code=1011, reason="Shell exited")


async def interrupt_foreground(shell):
    try:
        os.write(shell["fd"], b"\x03")
    except OSError:
        return

    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        await asyncio.sleep(0.05)
        if not shell["busy"]:
            return

    process_group = foreground_process_group(shell)
    if process_group != shell["pid"]:
        stop_process_group(process_group, signal.SIGKILL)
    stop_descendants(shell, signal.SIGKILL)


async def monitor_command_timeout(websocket, shell, send_lock):
    while not shell["closed"]:
        started_at = shell["busy_started"]
        if shell["busy"] and started_at is not None and time.monotonic() - started_at >= COMMAND_TIMEOUT:
            shell["busy_started"] = None
            await send_message(
                websocket,
                send_lock,
                "timeout",
                seconds=int(COMMAND_TIMEOUT),
            )
            await interrupt_foreground(shell)

        await asyncio.sleep(0.1)


async def handle_client_message(websocket, shell, send_lock, raw_message):
    if not isinstance(raw_message, str):
        await send_message(websocket, send_lock, "error", message="Binary client messages are not supported.")
        return

    try:
        message = json.loads(raw_message)
    except json.JSONDecodeError:
        await send_message(websocket, send_lock, "error", message="Invalid terminal message.")
        return

    message_type = message.get("type")
    if message_type == "input":
        try:
            data = base64.b64decode(message.get("data", ""), validate=True)
        except (ValueError, TypeError):
            await send_message(websocket, send_lock, "error", message="Invalid terminal input.")
            return
        if len(data) > MAX_INPUT_BYTES:
            await send_message(websocket, send_lock, "error", message="Terminal input is too large.")
            return
        if data:
            os.write(shell["fd"], data)
            touch()
            if not shell["busy"] and (b"\r" in data or b"\n" in data):
                shell["busy"] = True
                shell["busy_started"] = time.monotonic()
                await send_message(websocket, send_lock, "state", state="busy")
        return

    if message_type == "resize":
        cols = message.get("cols")
        rows = message.get("rows")
        if isinstance(cols, int) and isinstance(rows, int):
            set_window_size(shell["fd"], max(2, min(cols, 500)), max(1, min(rows, 200)))
        return

    if message_type == "interrupt":
        touch()
        await interrupt_foreground(shell)
        return

    await send_message(websocket, send_lock, "error", message="Unknown terminal message type.")


async def terminal_connection(websocket):
    global active_websocket, active_shell

    verified_header = websocket.request.headers.get("X-Verified-User-Data", "")
    try:
        verified_metadata = json.loads(verified_header)
    except json.JSONDecodeError:
        verified_metadata = None
    if not isinstance(verified_metadata, dict) or verified_metadata.get("sessionId") != EXPECTED_SESSION:
        await websocket.close(code=1008, reason="Invalid session")
        return

    async with connection_lock:
        previous_websocket = active_websocket
        previous_shell = active_shell
        if previous_websocket is not None:
            await previous_websocket.close(code=1012, reason="Terminal opened in another tab")
        stop_shell(previous_shell)

        shell = spawn_shell()
        active_websocket = websocket
        active_shell = shell
        touch()

    send_lock = asyncio.Lock()
    output_task = asyncio.create_task(relay_output(websocket, shell, send_lock))
    monitor_task = asyncio.create_task(monitor_command_timeout(websocket, shell, send_lock))

    def close_on_task_failure(task):
        if task.cancelled():
            return
        if task.exception() is not None:
            asyncio.create_task(websocket.close(code=1011, reason="Terminal bridge failed"))

    output_task.add_done_callback(close_on_task_failure)
    monitor_task.add_done_callback(close_on_task_failure)

    try:
        async for message in websocket:
            await handle_client_message(websocket, shell, send_lock, message)
    finally:
        output_task.cancel()
        monitor_task.cancel()
        await asyncio.gather(output_task, monitor_task, return_exceptions=True)
        stop_shell(shell)
        if active_websocket is websocket:
            active_websocket = None
            active_shell = None


async def monitor_inactivity():
    while True:
        observe_external_activity()
        remaining = IDLE_TIMEOUT - (time.monotonic() - last_activity)
        if remaining <= 0:
            shutdown_event.set()
            return
        await asyncio.sleep(min(remaining, 5))


async def main():
    inactivity_task = asyncio.create_task(monitor_inactivity())
    async with serve(
        terminal_connection,
        "0.0.0.0",
        PORT,
        max_size=MAX_INPUT_BYTES * 2,
        ping_interval=20,
        ping_timeout=20,
    ):
        await shutdown_event.wait()
        if active_websocket is not None:
            try:
                await active_websocket.send(encode_message("shutdown", reason="inactive"))
                await active_websocket.close(code=1001, reason="Terminal inactive")
            except Exception:
                pass

    inactivity_task.cancel()
    await asyncio.gather(inactivity_task, return_exceptions=True)
    stop_shell(active_shell)


asyncio.run(main())
`;
