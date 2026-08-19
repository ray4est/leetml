"use client";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";

export type TerminalConnectionState =
  | "connecting"
  | "ready"
  | "busy"
  | "disconnected"
  | "error";

export type TerminalController = {
  interruptAndWait: () => Promise<void>;
  sendCommand: (command: string) => Promise<void>;
  sendCommandAndWait: (command: string) => Promise<void>;
  writeNotice: (message: string) => void;
};

type InteractiveTerminalProps = {
  onControllerChange: (controller: TerminalController | null) => void;
  onStateChange: (state: TerminalConnectionState) => void;
};

type PrepareResponse =
  | {
      status: "ready";
      durationMs: number;
      terminalUrl: string;
      terminalToken: string;
    }
  | {
      error: string;
    };

type ServerMessage =
  | { type: "output"; data: string }
  | { type: "state"; state: "idle" | "busy" }
  | { type: "timeout"; seconds: number }
  | { type: "shutdown"; reason: "inactive" }
  | { type: "error"; message: string };

type StateWaiter = {
  state: TerminalConnectionState;
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: number;
};

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return window.btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function isPrepareResponse(value: unknown): value is PrepareResponse {
  if (!value || typeof value !== "object") return false;
  if ("error" in value) return typeof value.error === "string";

  return (
    "status" in value &&
    value.status === "ready" &&
    "durationMs" in value &&
    typeof value.durationMs === "number" &&
    "terminalUrl" in value &&
    typeof value.terminalUrl === "string" &&
    "terminalToken" in value &&
    typeof value.terminalToken === "string"
  );
}

function isServerMessage(value: unknown): value is ServerMessage {
  if (!value || typeof value !== "object" || !("type" in value)) return false;

  if (value.type === "output") return "data" in value && typeof value.data === "string";
  if (value.type === "state") {
    return "state" in value && (value.state === "idle" || value.state === "busy");
  }
  if (value.type === "timeout") {
    return "seconds" in value && typeof value.seconds === "number";
  }
  if (value.type === "shutdown") {
    return "reason" in value && value.reason === "inactive";
  }
  if (value.type === "error") {
    return "message" in value && typeof value.message === "string";
  }
  return false;
}

function terminalWebSocketUrl(terminalUrl: string, terminalToken: string) {
  const url = new URL(terminalUrl);
  if (url.protocol === "https:") url.protocol = "wss:";
  if (url.protocol === "http:") url.protocol = "ws:";
  url.searchParams.set("_modal_connect_token", terminalToken);
  return url.toString();
}

export function InteractiveTerminal({
  onControllerChange,
  onStateChange,
}: InteractiveTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [connectionState, setConnectionState] =
    useState<TerminalConnectionState>("connecting");
  const reconnectRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let connectionAttempt = 0;
    let reconnectTimer: number | null = null;
    let reconnectSuppressed = false;
    let socket: WebSocket | null = null;
    let state: TerminalConnectionState = "connecting";
    const stateWaiters: StateWaiter[] = [];

    const terminal = new Terminal({
      allowTransparency: true,
      convertEol: true,
      cursorBlink: true,
      disableStdin: false,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.45,
      scrollback: 5_000,
      theme: {
        background: "#0D131C",
        foreground: "#CBD5E1",
        cursor: "#60A5FA",
        black: "#0B0F14",
        brightBlack: "#64748B",
        green: "#22C55E",
        brightGreen: "#86EFAC",
        red: "#F87171",
        brightRed: "#FCA5A5",
        yellow: "#FBBF24",
        blue: "#60A5FA",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);

    function writeNotice(message: string) {
      terminal.writeln(`\r\n\x1b[90m[leetml] ${message}\x1b[0m`);
    }

    function rejectWaiters(message: string) {
      while (stateWaiters.length > 0) {
        const waiter = stateWaiters.pop();
        if (!waiter) continue;
        window.clearTimeout(waiter.timeout);
        waiter.reject(new Error(message));
      }
    }

    function updateState(nextState: TerminalConnectionState) {
      state = nextState;
      setConnectionState(nextState);
      onStateChange(nextState);

      for (let index = stateWaiters.length - 1; index >= 0; index -= 1) {
        const waiter = stateWaiters[index];
        if (waiter.state !== nextState) continue;
        stateWaiters.splice(index, 1);
        window.clearTimeout(waiter.timeout);
        waiter.resolve();
      }
    }

    function waitForNextState(nextState: TerminalConnectionState, timeoutMs: number) {
      return new Promise<void>((resolve, reject) => {
        const waiter: StateWaiter = {
          state: nextState,
          resolve,
          reject,
          timeout: window.setTimeout(() => {
            const index = stateWaiters.indexOf(waiter);
            if (index >= 0) stateWaiters.splice(index, 1);
            reject(new Error(`The terminal did not become ${nextState}.`));
          }, timeoutMs),
        };
        stateWaiters.push(waiter);
      });
    }

    function send(message: object) {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new Error("The terminal is not connected.");
      }
      socket.send(JSON.stringify(message));
    }

    function sendInput(data: string) {
      send({ type: "input", data: bytesToBase64(encoder.encode(data)) });
    }

    function sendResize() {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      send({ type: "resize", cols: terminal.cols, rows: terminal.rows });
    }

    function fitTerminal() {
      try {
        fitAddon.fit();
        sendResize();
      } catch {
        // xterm can briefly have zero dimensions while the responsive grid changes.
      }
    }

    async function interruptAndWait() {
      if (state !== "ready" && state !== "busy") {
        throw new Error("The terminal is not ready.");
      }
      const idle = waitForNextState("ready", 5_000);
      send({ type: "interrupt" });
      await idle;
    }

    async function sendCommand(command: string) {
      if (state !== "ready") throw new Error("The terminal is not ready.");
      const busy = waitForNextState("busy", 2_000).catch(() => undefined);
      sendInput(`${command}\r`);
      await busy;
    }

    async function sendCommandAndWait(command: string) {
      if (state !== "ready") throw new Error("The terminal is not ready.");
      const busy = waitForNextState("busy", 2_000);
      sendInput(`${command}\r`);
      await busy;
      await waitForNextState("ready", 10 * 60 * 1_000 + 30_000);
    }

    const controller: TerminalController = {
      interruptAndWait,
      sendCommand,
      sendCommandAndWait,
      writeNotice,
    };
    onControllerChange(controller);

    function scheduleReconnect(delayMs: number) {
      if (disposed || reconnectTimer !== null) return;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void prepareAndConnect();
      }, delayMs);
    }

    async function prepareAndConnect() {
      const attempt = ++connectionAttempt;
      reconnectSuppressed = false;
      socket?.close(1000, "Reconnecting");
      socket = null;
      rejectWaiters("The terminal reconnected.");
      updateState("connecting");

      try {
        const response = await fetch("/api/prepare", {
          method: "POST",
          cache: "no-store",
        });

        if (response.status === 401) {
          window.location.replace("/login?reason=expired");
          return;
        }

        const payload: unknown = await response.json();
        if (!isPrepareResponse(payload)) {
          throw new Error("The preparation service returned an unexpected response.");
        }
        if (!response.ok || !("status" in payload)) {
          throw new Error("error" in payload ? payload.error : "Unable to prepare the terminal.");
        }
        if (disposed || attempt !== connectionAttempt) return;

        const nextSocket = new WebSocket(
          terminalWebSocketUrl(payload.terminalUrl, payload.terminalToken),
        );
        socket = nextSocket;

        nextSocket.addEventListener("open", () => {
          if (disposed || socket !== nextSocket) return;
          sendResize();
        });

        nextSocket.addEventListener("message", (event) => {
          if (disposed || socket !== nextSocket || typeof event.data !== "string") return;

          let parsed: unknown;
          try {
            parsed = JSON.parse(event.data);
          } catch {
            writeNotice("The sandbox returned an invalid terminal message.");
            return;
          }
          if (!isServerMessage(parsed)) {
            writeNotice("The sandbox returned an unexpected terminal message.");
            return;
          }

          if (parsed.type === "output") {
            try {
              terminal.write(base64ToBytes(parsed.data));
            } catch {
              writeNotice("A terminal output frame could not be decoded.");
            }
            return;
          }

          if (parsed.type === "state") {
            updateState(parsed.state === "idle" ? "ready" : "busy");
            if (parsed.state === "idle") terminal.focus();
            return;
          }

          if (parsed.type === "timeout") {
            writeNotice(`Foreground command exceeded ${parsed.seconds} seconds and was interrupted.`);
            return;
          }

          if (parsed.type === "shutdown") {
            reconnectSuppressed = true;
            writeNotice("The sandbox stopped after one hour without terminal activity.");
            return;
          }

          writeNotice(parsed.message);
        });

        nextSocket.addEventListener("error", () => {
          if (disposed || socket !== nextSocket) return;
          updateState("error");
        });

        nextSocket.addEventListener("close", (event) => {
          if (disposed || socket !== nextSocket) return;
          socket = null;
          rejectWaiters("The terminal disconnected.");

          const replaced = event.code === 1012 || /another tab/i.test(event.reason);
          const inactive = reconnectSuppressed || /inactive/i.test(event.reason);
          updateState("disconnected");

          if (replaced) {
            writeNotice("This terminal was replaced by a newer tab. Reconnect to take control.");
          } else if (inactive) {
            writeNotice("The sandbox stopped after one hour without terminal activity.");
          } else {
            writeNotice("Terminal disconnected. Reconnecting…");
            scheduleReconnect(1_000);
          }
        });
      } catch (error) {
        if (disposed || attempt !== connectionAttempt) return;
        updateState("error");
        writeNotice(error instanceof Error ? error.message : "Unable to prepare the terminal.");
        scheduleReconnect(10_000);
      }
    }

    reconnectRef.current = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      void prepareAndConnect();
    };

    const dataDisposable = terminal.onData((data) => {
      try {
        sendInput(data);
      } catch {
        // The connection-state UI handles input attempted during reconnects.
      }
    });
    const resizeObserver = new ResizeObserver(fitTerminal);
    resizeObserver.observe(container);
    fitTerminal();
    writeNotice("Preparing your session sandbox…");
    void prepareAndConnect();

    return () => {
      disposed = true;
      connectionAttempt += 1;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      socket?.close(1000, "Page closed");
      rejectWaiters("The terminal closed.");
      resizeObserver.disconnect();
      dataDisposable.dispose();
      terminal.dispose();
      reconnectRef.current = () => undefined;
      onControllerChange(null);
    };
  }, [onControllerChange, onStateChange]);

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div
        ref={containerRef}
        aria-label="Interactive sandbox terminal"
        style={{ height: "100%" }}
      />
      {(connectionState === "disconnected" || connectionState === "error") && (
        <button
          type="button"
          onClick={() => reconnectRef.current()}
          style={{
            position: "absolute",
            right: 16,
            bottom: 14,
            padding: "7px 10px",
            border: "1px solid #334155",
            borderRadius: 6,
            background: "#111827",
            color: "#cbd5e1",
            cursor: "pointer",
            font: "600 11px ui-sans-serif, system-ui, sans-serif",
          }}
        >
          Reconnect terminal
        </button>
      )}
    </div>
  );
}
