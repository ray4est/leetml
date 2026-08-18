# LeetML

LeetML v0 is a single machine-learning coding exercise with browser-based editing and isolated test execution.

## Prerequisites

- Node.js 22 or newer
- npm
- A Modal account and API token

## Setup

Install the application dependencies:

```bash
npm install
```

Create the local environment file:

```bash
cp .env.example .env.local
```

```dotenv
APP_ACCESS_PASSWORD=a-unique-passphrase-at-least-20-characters-long
SESSION_SECRET=a-random-secret-containing-at-least-32-bytes
MODAL_TOKEN_ID=your-token-id
MODAL_TOKEN_SECRET=your-token-secret
```

Use a password manager to generate and share `APP_ACCESS_PASSWORD` with the two trusted users. Generate `SESSION_SECRET` separately; for example:

```bash
openssl rand -base64 32
```

Do not share `SESSION_SECRET`, and do not commit `.env.local` or any of its values. Add all four variables to the production host as deployment secrets.

Build and publish the pinned Python runtime before the first execution:

```bash
npm run modal:prepare
```

Start the application:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). After the terminal prompt appears, you can run normal shell commands. Edit `solution.py` in Monaco and select **Run tests** to save it and send pytest through that terminal.

## Authentication

The workspace and execution API require the shared passphrase. A successful login creates a signed, HTTP-only session cookie that lasts for 30 days. The cookie uses `SameSite=Strict`, and production deployments also mark it `Secure`.

There are no individual accounts in v0. Changing `APP_ACCESS_PASSWORD` does not immediately revoke existing sessions; changing `SESSION_SECRET` invalidates every session and requires both users to sign in again.

## Runtime behavior

When an authenticated workspace opens, `POST /api/prepare` creates or retrieves a sandbox dedicated to that login session, warms Python, NumPy, and scikit-learn, and returns a Modal Connect Token for the sandbox terminal bridge. xterm.js then connects directly to a bash PTY in `/workspace`.

Run Tests first interrupts any foreground process, saves Monaco through `POST /api/solution`, and sends `python -m pytest -q --disable-warnings --maxfail=1` into that PTY. Terminal edits do not flow back to Monaco; the next Run Tests overwrites `solution.py` with the Monaco buffer.

The bridge exits after one hour without terminal input or output, including when an idle browser leaves its WebSocket open. The sandbox also has Modal's one-hour idle fallback and a 24-hour absolute lifetime. Logout terminates it immediately. Reconnecting starts a fresh bash process while the current Sandbox and its files still exist.

Each sandbox has:

- Python 3.12 with pinned NumPy, scikit-learn, and pytest versions
- One CPU with a hard one-CPU limit
- 1 GiB reserved memory and a 2 GiB hard limit
- A 10-minute limit for each foreground process group
- A one-hour inactivity timeout and 24-hour absolute sandbox lifetime
- Network access disabled

Only one terminal connection is active per Sandbox. Opening it in a newer tab replaces the prior shell. The terminal connection uses a bearer token returned only after application authentication; do not log or share terminal WebSocket URLs.

## Manual acceptance test

1. Sign in and wait for a colored `ray@leetml` prompt.
2. Run `pwd`, `python --version`, and `python -c "import sklearn; print(sklearn.__version__)"`.
3. Run `python -c "import socket; socket.create_connection(('1.1.1.1', 53), 2)"` and confirm outbound networking is blocked.
4. Leave the starter solution unchanged, select **Run tests**, and observe the pytest command and failure live in the terminal.
5. Implement `train_and_predict`, rerun, and confirm all three tests pass.
6. Run `sleep 60`, then select **Run tests** and confirm the sleep command is interrupted before pytest starts.
7. Reload the page and confirm a fresh prompt opens and `/workspace/solution.py` still exists.
8. Open a second tab and confirm it takes over the terminal; use **Reconnect terminal** in the first tab to take it back.
9. Sign out and confirm a later sign-in provisions a new Sandbox.

## Development checks

```bash
npm run lint
npm run build
```

The real Modal integration requires valid values in `.env.local`; a mocked execution does not satisfy the v0 definition of done.
