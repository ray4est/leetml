# LeetML

LeetML v0 is an adventure-style machine-learning learning path with one playable coding quest, browser-based editing, and isolated test execution.

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

Open [http://localhost:3000](http://localhost:3000) to view the public expedition map. Select **Start first quest**, sign in, and wait for the terminal prompt. You can then run normal shell commands, edit `solution.py` in Monaco, and select **Run tests** to save it and send pytest through the terminal.

## Authentication

The learning path at `/` is public and never prepares a Modal Sandbox. The workspace at `/tasks/handwritten-digit-reader` and every execution API require the shared passphrase. A successful login creates a signed, HTTP-only session cookie that lasts for 30 days. The cookie uses `SameSite=Strict`, and production deployments also mark it `Secure`.

When a protected task sends a learner to login, an allowlisted `next` value returns them directly to that task. Unknown, malformed, or external destinations fall back to `/` to prevent open redirects.

There are no individual accounts in v0. Changing `APP_ACCESS_PASSWORD` does not immediately revoke existing sessions; changing `SESSION_SECRET` invalidates every session and requires both users to sign in again.

## Runtime behavior

When the authenticated digit-reader workspace opens, `POST /api/prepare` creates or retrieves a sandbox dedicated to that login session, warms Python, NumPy, and scikit-learn, and returns a Modal Connect Token for the sandbox terminal bridge. Merely viewing the public map does not mount the terminal or call this endpoint. xterm.js connects directly to a bash PTY in `/workspace`.

Run Tests first interrupts any foreground process, saves Monaco through `POST /api/solution`, and sends `python -m pytest -q -s --disable-warnings --maxfail=1` into that PTY. Terminal edits do not flow back to Monaco; the next Run Tests overwrites `solution.py` with the Monaco buffer.

The first exercise is a handwritten digit reader using scikit-learn's built-in 8 × 8 digits dataset. A fixed split supplies 1,347 labelled training images and 450 test images. Tests print the current accuracy, the most-confused digit pair, and three mistakes as grayscale terminal art so each run gives concrete feedback.

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

1. Open `/` while signed out and confirm the full learning map renders without a request to `/api/prepare`.
2. Confirm the digit reader is the only actionable quest and the other four quests say **Being built**.
3. Select **Start first quest**, sign in, and confirm you arrive at `/tasks/handwritten-digit-reader` rather than returning to the map.
4. Confirm the workspace brand and **Map** control return to `/`, then reopen the quest and wait for a colored `ray@leetml` prompt.
5. Run `pwd`, `python --version`, and `python -c "import sklearn; print(sklearn.__version__)"`.
6. Run `python -c "import socket; socket.create_connection(('1.1.1.1', 53), 2)"` and confirm outbound networking is blocked.
7. Leave the starter solution unchanged, select **Run tests**, and observe the pytest command and `NotImplementedError` live in the terminal.
8. Implement `predict_digits` by fitting the model and returning its predictions.
9. Rerun and confirm all four tests pass, the score reaches 96%, and three misclassified digits appear as terminal art.
10. Change `n_neighbors` or `weights`, rerun, and compare the score and visible mistakes.
11. Run `sleep 60`, then select **Run tests** and confirm the sleep command is interrupted before pytest starts.
12. Reload the page and confirm a fresh prompt opens and `/workspace/solution.py` still exists.
13. Open a second tab and confirm it takes over the terminal; use **Reconnect terminal** in the first tab to take it back.
14. Sign out and confirm you return to the public map and that a later sign-in provisions a new Sandbox.

## Development checks

```bash
npm run lint
npm run build
```

The real Modal integration requires valid values in `.env.local`; a mocked execution does not satisfy the v0 definition of done.
