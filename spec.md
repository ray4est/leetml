# Technical Specification

## Technical stack

- **Application framework:** Next.js App Router and React
- **Application language:** TypeScript on Node.js 22+
- **Code editor:** Monaco Editor
- **Terminal:** xterm.js connected to an interactive PTY over WebSocket
- **Runtime and execution environment:** Modal Sandboxes and Modal Connect Tokens
- **Sandbox language and packages:** Python 3.12, NumPy, scikit-learn, pytest, bash, and a pinned Python WebSocket server
- **Authentication:** Shared passphrase with HMAC-SHA256 signed, HTTP-only sessions
- **Cryptography:** Node.js built-in `crypto`; no authentication service or database
- **Styling:** CSS Modules and global CSS tokens
- **State:** Static visual learning-path state, local React workspace state, and session-scoped sandbox files; no database in v0

## Responsibilities

- Monaco Editor is the source of truth for `solution.py`.
- xterm.js provides shell input, terminal resizing, ANSI rendering, and live PTY output.
- A small Python WebSocket-to-PTY bridge runs as the sandbox entrypoint and starts bash in `/workspace`.
- Modal Connect Tokens authenticate the direct browser-to-sandbox WebSocket without depending on WebSocket support from the Next.js host.
- Modal Sandboxes provide session-scoped files, isolated shell execution, pinned Python packages, and resource limits.

## v0 scope

The v0 is a public adventure-style learning path leading into one complete coding, shell, and testing loop for a single hard-coded scikit-learn exercise.

### User flow

1. Explore the public five-quest learning map without starting a Sandbox.
2. Select the available handwritten-digit quest; the four later quests remain visibly marked **Being built**.
3. Enter the shared family passphrase and return directly to the selected task.
4. Open the exercise while the backend provisions a session-specific Modal Sandbox.
5. The backend writes the public test file, prewarms Python packages, and issues a session-bound Modal Connect Token.
6. xterm.js connects to a bash PTY in `/workspace`; normal commands, Ctrl+C, ANSI output, and terminal resizing work.
7. Edit `solution.py` in Monaco Editor.
8. Click **Run tests**. Any foreground command is interrupted, Monaco is saved to `/workspace/solution.py`, and the browser sends the pytest command through the PTY.
9. The command, live pytest output, accuracy, most-confused pair, and misclassified digit art appear in the same terminal.
10. Files remain in the healthy Sandbox for later commands and test runs.
11. The Sandbox terminates on logout, after one hour without terminal input or output, on infrastructure failure, or at its 24-hour absolute lifetime.

### Included

- A public, responsive explorer-map landing page at `/` with five static quest nodes.
- A protected workspace at `/tasks/handwritten-digit-reader` with Monaco Editor and an interactive xterm.js terminal side by side.
- One available quest and four non-interactive **Being built** roadmap entries.
- One hard-coded scikit-learn exercise, starter solution, and public pytest file.
- A Modal image with pinned Python, NumPy, scikit-learn, pytest, and WebSocket dependency versions.
- One authenticated preparation and terminal-credential endpoint.
- One authenticated source-save endpoint with a 50 KiB limit and same-origin enforcement.
- One named, prewarmed Modal Sandbox per authenticated browser session.
- A direct, Connect Token-authenticated WebSocket to the sandbox PTY bridge.
- One active shell connection per Sandbox; a newer tab replaces the previous terminal.
- A fresh bash process after reconnect while files in the Sandbox remain available.
- A 10-minute foreground-process limit, one-hour inactivity limit, and 24-hour absolute Sandbox lifetime.
- A shared-passphrase login for exactly two trusted users, with an allowlisted return path to the selected task.
- A signed 30-day session and a sign-out action.
- Authentication checks before parsing or performing sandbox operations.
- Basic preparation, connection, source-save, protocol, timeout, and disconnection reporting.

### Learning path

The public landing page presents a CSS- and SVG-rendered explorer map. Its progress language is intentionally static: **1 trail open · 4 being built**, with an **Explorer rank: Trailhead** badge and reward previews that are not earned or persisted.

1. **Pixel Pass — Handwritten Digit Reader:** image classification; available at `/tasks/handwritten-digit-reader`.
2. **Signal Woods — Spam Shield:** text classification; roadmap only.
3. **Forecast Falls — Bike Demand Forecaster:** regression; roadmap only.
4. **Neural Ridge — Fashion Sorter:** neural networks; roadmap only.
5. **Storyforge Summit — Tiny Story Generator:** nanoGPT-style language modeling; roadmap only.

The active quest is a link with a **Ready to play** status. Future cards are non-interactive content with lock imagery, **Being built**, and **Trail closed** labels. Motion is decorative and disabled when `prefers-reduced-motion` is active.

### Exercise

Build a toy parcel-sorter digit reader using scikit-learn's built-in handwritten digits dataset. Each input is an 8 × 8 grayscale image flattened to 64 pixel features. The deterministic stratified split contains 1,347 training images and 450 test images.

Implement `predict_digits(X_train, y_train, X_test)`. The starter imports `KNeighborsClassifier`, while any scikit-learn classifier is allowed. Tests verify:

- The output contains exactly one prediction for every test image.
- Predictions are integer labels from 0 through 9.
- The function does not mutate the supplied arrays.
- Predictions reach at least 96% accuracy.

Every complete evaluation prints the score, the most frequent actual-to-predicted confusion, and three misclassified 8 × 8 images using terminal-safe grayscale characters. The problem panel also shows a pixel-grid example with its known label.

## Public interfaces

### `POST /api/prepare`

- Requires a valid application session and returns `401` before contacting Modal otherwise.
- Creates or retrieves the session Sandbox, initializes `/workspace/test_solution.py`, initializes the starter solution only when absent, imports NumPy and scikit-learn, and waits for the PTY bridge readiness probe.
- Returns `{ status: "ready", durationMs, terminalUrl, terminalToken }` with `Cache-Control: no-store`.
- The token is scoped to the bridge port and carries `{ sessionId }` as Modal-verified JSON metadata.

### `POST /api/solution`

- Requires a valid application session and a same-origin request before parsing the body.
- Accepts `{ code: string }`, rejects blank or over-50-KiB content, and atomically replaces `/workspace/solution.py` through a temporary file.
- Returns `{ status: "saved" }`, `409` when the Sandbox expired, and structured errors for validation or infrastructure failures.

### Terminal protocol

- Browser messages are JSON: `input` with base64 bytes, `resize` with bounded rows and columns, or `interrupt`.
- Bridge messages are JSON: base64 `output`, `state` (`idle` or `busy`), `timeout`, inactivity `shutdown`, or `error`.
- The bridge accepts only a Modal-verified session identifier matching `LEETML_SESSION_ID`.
- Run Tests sends `python -m pytest -q -s --disable-warnings --maxfail=1` through the protocol after saving Monaco. Capture is disabled so educational feedback printed by the tests remains visible.

## Authentication and terminal security

- `APP_ACCESS_PASSWORD` stores a unique shared passphrase of at least 20 characters.
- `SESSION_SECRET` stores at least 32 random bytes used to sign sessions.
- The passphrase is submitted only to `POST /api/login`, limited to 256 characters, checked with a timing-safe comparison, and never placed in a cookie.
- A successful login sets `leetml_session` to `v1.<expiry>.<nonce>.<signature>`, where the signature is HMAC-SHA256 over the preceding fields.
- Sessions expire after 30 days. The cookie is `HttpOnly`, `SameSite=Strict`, `Path=/`, high priority, and `Secure` in production.
- The public home page has no authentication or sandbox dependency. The digit-reader task redirects unauthenticated visitors to `/login?next=/tasks/handwritten-digit-reader` before rendering the editor.
- Login accepts only allowlisted local return paths; all external, malformed, or unknown values fall back to `/`.
- Missing or weak authentication environment variables fail closed with `503` from authentication-sensitive API routes.
- The sandbox name is derived from the high-entropy signed session token, so the two users do not share files or shells.
- The terminal token remains only in component memory, is never logged, and is revoked by Sandbox termination.
- The bridge is the only process receiving the session identifier; Modal credentials are never injected into the Sandbox.
- Sandbox outbound CIDR and domain allowlists are both empty, preserving zero egress while allowing authenticated inbound Connect Token traffic. Modal's `blockNetwork` flag is not used because it also blocks the terminal tunnel.
- Logout attempts to terminate the session Sandbox before clearing the application cookie.

## Sandbox lifecycle

- The Python PTY bridge is the Sandbox entrypoint and exposes only the Connect Token port.
- An in-sandbox exec readiness probe connects to localhost port 8080 before terminal credentials are returned.
- Existing Sandboxes without the `terminal-v6` runtime tag or current exercise ID are terminated and replaced, so an exercise change cannot retain stale solution or test files.
- Concurrent preparation requests in one application process share a promise; the named Modal Sandbox prevents duplicate creation across processes.
- The canonical public tests are refreshed at preparation, while an existing solution is preserved until Monaco is explicitly saved.
- A browser reconnect starts a new bash process in the same Sandbox; running jobs and shell history do not survive.
- A new tab closes the previous terminal connection and its shell to prevent concurrent file and PTY races.
- Pressing Enter marks the shell busy; a hidden `PROMPT_COMMAND` marker marks it idle when bash returns to the prompt, and the bridge strips that marker before sending output to xterm.js.
- The bridge signals the PTY foreground process group after 10 busy minutes, sending `SIGINT` and escalating to `SIGKILL` after a short grace period.
- The bridge records terminal input and output as activity and exits after one inactive hour, even if the WebSocket remains open.
- Modal also receives `idleTimeoutMs: 3_600_000` as a backup and `timeoutMs: 86_400_000` as the absolute lifetime.
- Before inactivity shutdown the bridge sends an explicit protocol message, preventing the client from immediately provisioning a replacement. Transient failures still reconnect automatically, while inactivity or replacement by another tab requires **Reconnect terminal**.
- If a named Sandbox has stopped, the next explicit preparation creates a replacement automatically.

## Non-goals

- Individual identities, email addresses, roles, account recovery, OAuth, or a database.
- Saved submissions after Sandbox termination.
- Implemented exercises beyond the digit reader, hidden tests, a file explorer, or multiple Monaco editor tabs. Future quest cards are visual roadmap entries only.
- Persisted XP, ranks, quest completion, unlocks, or per-user learning progress.
- Two-way synchronization from shell file edits back into Monaco; the next Run Tests overwrites `solution.py` with Monaco content.
- Persistent tmux-style shells across reloads.
- Internet package installation from the terminal.
- Per-user quotas, collaboration, GPU execution, or production nanoGPT training in v0.

## Definition of done

`Explore the public map without Modal activity → Choose Pixel Pass → Sign in and return to the task → Sandbox and PTY bridge become ready → Inspect an 8 × 8 digit → Edit Monaco → Run Tests saves solution.py and types pytest into the PTY → Score and visible mistakes appear → Iterate on the model → Return to the map or sign out`
