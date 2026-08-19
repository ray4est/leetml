# Handwriting Reader Lab v0 Technical Specification

## Product outcome

Handwriting Reader Lab is a protected, single-page machine-learning lesson for a gifted 12-year-old. It first makes the limits of hand-written recognition rules concrete, then lets the learner use a ready-made model, train a scikit-learn model, and compare both models on the same visual inputs.

Authentication is required before any lab content renders. Authentication itself must not create compute; only a separate, explicit learner action may start a Modal Sandbox.

## Technical stack

- **Framework:** Next.js 16 App Router and React 19
- **Application language:** TypeScript on Node.js 22+
- **Code editor:** Monaco Editor
- **Terminal:** xterm.js with fit support, connected to an interactive PTY over WebSocket
- **Execution:** Modal Sandboxes and Modal Connect Tokens
- **Python runtime:** Python 3.12, NumPy, scikit-learn, joblib, pytest, bash, and a pinned Python WebSocket server
- **Built-in inference:** A TypeScript implementation of distance-weighted 3-nearest-neighbours using a static 1,347-image training split and 20 held-out samples exported from scikit-learn's digits dataset
- **Learner inference:** A joblib artifact loaded and executed only inside the learner's Modal Sandbox
- **Authentication:** Shared passphrase with HMAC-SHA256-signed HTTP-only sessions
- **Styling:** CSS Modules and global CSS tokens
- **State:** React state, a tab-scoped `sessionStorage` editor draft, static browser-model data, and session-scoped sandbox files; no database

## v0 scope

### User flow

1. Authenticate before the server renders any lesson, playground, editor, hints, or terminal markup.
2. Read the lab goal: understand the concepts, train a model, test supplied images and personal handwriting, and find at least one correct and one incorrect handwriting prediction.
3. Compare rule-based programming with machine learning; introduce each required term before its first instructional use.
4. Learn data, feature, ground truth, label, training data, and test data through study/test analogies.
5. Explore study or test samples as an image, 8 × 8 grayscale-number grid, Python array, and answer.
6. Choose one of 20 held-out digit images or draw a digit with mouse, pen, or touch.
7. Ask the built-in browser model to predict; reveal its three nearest labelled training images and, for held-out images, the true label as immediate feedback.
8. Inspect and edit the protected starter code in an inline Monaco editor, following steps that state both the action and its purpose.
9. Navigate three progressive hints one at a time with Previous/Next controls; the third contains a complete copyable solution. Allow copying, while recommending that the learner type the code using hints as a reference.
10. Choose **Start lab** or **Train my model** to explicitly start or reconnect a session-specific Modal Sandbox and xterm.js shell.
11. Train: interrupt a busy foreground process, save Monaco as `/workspace/solution.py`, and send `rm -f model.joblib model-meta.json && python solution.py && python evaluate_model.py` through the terminal.
12. See live Python output and accuracy in xterm.js. A valid model artifact automatically unlocks **My model** and scrolls back to the Playground.
13. Use the custom model on supplied images or drawings. Each custom prediction executes inside the current sandbox and refreshes its activity timestamp.
14. Reset to terminate the sandbox, restore starter code, lock the custom model, and clear transient lesson state.
15. Lose the custom model when the sandbox terminates on reset, logout, three-hour inactivity, infrastructure failure, or its absolute lifetime.

### Page structure

- **Hero:** states the experiment, the full correct/incorrect prediction mission, and links to the problem.
- **Problem:** compares programming with ML; defines training, model, prediction, data, feature, ground truth, label, and the six dataset variables; provides an interactive sample-data explorer; then introduces KNN, `k`, and distance.
- **Playground:** switches between supplied test images and a drawing canvas, shows the 8 × 8 model input, selects built-in or learner model, and displays predictions with nearest digits.
- **Do it yourself:** contains action-plus-purpose steps, Monaco with a same-row Hints navigator, the explicit compute gate, xterm.js stacked below the editor column, reset, training status, errors, and the model-unlocked callout.
- **Footer:** promises future experiments without presenting a fake progress system or interactive unfinished tasks.

### Included

- A responsive, accessible lesson at `/`, rendered only after server-side session verification.
- A browser-local built-in classifier with no runtime API call.
- The three nearest labelled study digits, distances, and weighted-vote intuition for built-in predictions.
- A study/test sample explorer with image, feature-number grid, Python array, and ground-truth answer views.
- Twenty balanced held-out digit samples with answers hidden until prediction.
- A pointer-editable 8 × 8 pixel canvas, clear control, drag interpolation, and an exact model-input preview.
- A protected, editable Monaco Python file and tab-scoped draft preservation.
- Three progressive hints shown one at a time with Previous/Next navigation and copy/insert actions on the complete solution.
- A protected reset that terminates the sandbox and restores starter client state.
- A protected, explicitly mounted xterm.js shell in a private Modal Sandbox.
- Automatic save, training command dispatch, accuracy evaluation, and custom-model unlock.
- Protected status and inference endpoints for a session model.
- One named, prewarmed sandbox per authenticated session.
- Three-hour inactivity and 24-hour absolute sandbox limits.
- Shared-passphrase access intended for two trusted family members.
- A redirect from the legacy task URL to the inline lab anchor.

## Learning design and model contracts

### Dataset

Both models use scikit-learn's built-in digits dataset. Each grayscale image is represented by 64 values from 0 through 16. A deterministic stratified 75/25 split with `random_state=42` yields 1,347 training images and 450 held-out images.

### Built-in model

The browser model mirrors `KNeighborsClassifier(n_neighbors=3, weights="distance")`. Its measured accuracy on the full fixed test set is about 98.4%. It stores the 1,347 labelled training images, measures Euclidean pixel distance to a new image, selects the three smallest distances, and combines their labels with closer neighbours receiving more voting weight. It has no server, authentication, Modal, or persistence dependency.

The 20-image gallery contains two examples of each true digit. The model may be wrong; showing both prediction and answer turns errors into useful feedback rather than hiding them.

### Drawing input

The canvas itself is 8 × 8 pixels and is enlarged with nearest-neighbour rendering plus a visible grid. Pointer presses and drags paint cells at brightness 16; line interpolation fills any cells skipped by a fast pointer movement. The resulting 64 values are sent to the model unchanged.

An empty canvas produces no model input and keeps prediction disabled. The exact 8 × 8 input is visible so a poor prediction has an inspectable cause.

### Learner artifact

The starter asks the learner to split the dataset, fit a classifier, and save it with `joblib.dump(..., "model.joblib")`. Any serialized object is accepted if its `predict` method returns exactly 450 integer labels from 0 through 9 for the evaluator's fixed test split.

`evaluate_model.py` validates the artifact, computes accuracy, and atomically writes:

```json
{
  "accuracy": 0.9844444444444445,
  "trainedAt": "2026-08-19T00:00:00+00:00"
}
```

There is deliberately no minimum accuracy gate in v0: a weak but structurally valid model unlocks so the learner can see its mistakes and improve it. The complete K-nearest-neighbours solution normally scores about 98.4%.

Custom inference validates exactly 64 finite numbers in the range 0–16 at both the application and Python boundaries. When the learner artifact is a direct `KNeighborsClassifier`, the response also contains its three nearest fitted images, labels, and distances. Joblib loading occurs only inside the network-isolated learner sandbox, never in the Next.js process.

## Component responsibilities

- `DigitReaderLesson` owns lesson navigation, editor draft, auth/compute gating, hints, terminal command orchestration, model status, and automatic unlock.
- `DataExplorer` owns study/test sample selection and the image, numbered-feature, Python-array, and ground-truth views.
- `DigitPlayground` owns input mode, sample choice, model choice, prediction state, result, and true-label feedback.
- `DigitCanvas` owns direct pointer editing of the digits dataset's 8 × 8 value shape.
- `CodeEditor` wraps Monaco and edits the current `solution.py` buffer.
- `InteractiveTerminal` owns Connect Token preparation, WebSocket protocol, xterm.js rendering, reconnect, interruption, and command-completion waiting.
- The Python bridge starts bash in `/workspace`, relays PTY bytes, tracks busy/idle state, resizes, interrupts, limits foreground commands, and enforces inactivity.
- Modal owns compute isolation, files, packages, limits, and the direct authenticated WebSocket endpoint.

## Public interfaces

### `GET /`

- Verify the signed session cookie in the Server Component before rendering the lab.
- Redirect unauthenticated requests to `/login`; do not include lesson, playground, editor, hints, or terminal markup in the response.
- If authentication is not configured, redirect to the login page, where the configuration error is shown without exposing the lab.
- Never contact Modal while rendering the page.

### `POST /api/prepare`

- Authenticate before contacting Modal; otherwise return `401`.
- Create or retrieve the named session sandbox only after this explicit request.
- Refresh `/workspace/evaluate_model.py` and `/workspace/predict_model.py`; create starter `solution.py` only when missing.
- Pre-import NumPy and scikit-learn and wait for the PTY readiness probe.
- Return `{ status: "ready", durationMs, terminalUrl, terminalToken }` with `Cache-Control: no-store`.
- Scope the Connect Token to port 8080 with Modal-verified `{ sessionId }` metadata.

### `POST /api/solution`

- Authenticate and enforce same origin before parsing the request.
- Accept `{ code: string }`; reject blank or larger-than-50-KiB content.
- Atomically replace `/workspace/solution.py`.
- Return `{ status: "saved" }`, or `409` when no live session sandbox exists.

### `POST /api/reset`

- Authenticate and enforce same origin before contacting Modal.
- Terminate the current session sandbox if it exists; never create a replacement.
- Return `{ status: "reset" }` with `Cache-Control: no-store`.
- After success, the client removes its saved draft, restores starter code with a fresh editor instance, returns Hints to the first page, clears playground state, selects the built-in model, and leaves the lab explicitly stopped.

### `GET /api/model/status`

- Authenticate before contacting Modal; otherwise return `401`.
- Never create a sandbox.
- Return `{ status: "missing" }` if the sandbox, artifact, metadata, or valid metadata is absent.
- Return `{ status: "ready", accuracy, trainedAt }` for a valid current-session artifact.
- Set `Cache-Control: no-store`.

### `POST /api/model/predict`

- Authenticate and enforce same origin before parsing.
- Limit the request body to 4 KiB.
- Accept `{ pixels: number[64] }`, where all values are finite and between 0 and 16.
- Require both `model.joblib` and `model-meta.json`; otherwise return `409`.
- Touch `/workspace/.leetml-activity`, execute `predict_model.py` in the sandbox, validate one integer digit, and return `{ digit }` with `Cache-Control: no-store`.
- Return `{ digit, neighbors? }`; `neighbors` contains three `{ label, pixels, distance }` values when the model exposes KNN training data.
- Return `400` for invalid pixels and `502` for infrastructure failures.

### Terminal protocol

- Browser messages: base64 `input`, bounded `resize`, or `interrupt`.
- Bridge messages: base64 `output`, `state` (`idle` or `busy`), `timeout`, inactivity `shutdown`, or `error`.
- The bridge accepts only Modal-verified metadata whose session identifier matches `LEETML_SESSION_ID`.
- `sendCommandAndWait` writes a command and resolves only after the bridge reports a return to the shell prompt.
- A new connection closes the previous shell for the same sandbox.

## Authentication and security

- `APP_ACCESS_PASSWORD` is a unique shared passphrase of at least 20 characters.
- `SESSION_SECRET` is at least 32 bytes and signs sessions with HMAC-SHA256.
- Password comparison is timing-safe; the password is never stored in the cookie.
- The signed cookie format is `v1.<expiry>.<nonce>.<signature>`, expires after 30 days, and is `HttpOnly`, `SameSite=Strict`, `Path=/`, high-priority, and `Secure` in production.
- The login page remains available when authentication is unconfigured, but `/` fails closed and never renders lab content.
- The normal login destination is `/`; `/#do-it-yourself` is the only non-default allowlisted return. Unknown, malformed, or external paths return to `/`.
- The sandbox name is derived from a high-entropy signed-session token, so the two browsers do not share files or shells.
- Authentication is checked before body parsing or sandbox operations. Mutating endpoints also require same-origin `Origin` or `Referer` evidence.
- Modal credentials never enter the sandbox. Connect Tokens remain in browser memory and are not logged.
- Outbound CIDR and domain allowlists are empty. Inbound terminal traffic still uses Modal's authenticated tunnel.
- Loading learner-created joblib is intentionally confined to that learner's resource-limited, zero-egress sandbox because joblib artifacts may execute Python during deserialization.
- Logout attempts sandbox termination before clearing the session cookie.

The passphrase is an access capability, not an account system: the application cannot distinguish the parent from the child or prevent a leaked passphrase from being reused. Rotate both the passphrase and session secret if it is exposed.

## Sandbox lifecycle

- Runtime tag: `digit-lab-v2`; exercise tag: `handwritten-digit-lab-v2`. Stale sandboxes with other tags are terminated and replaced.
- Concurrent prepare calls within one application process share a promise; Modal's named sandbox prevents duplicates across processes.
- Terminal input/output calls `touch()` in the bridge. Custom inference updates `.leetml-activity`, which the bridge observes as external activity.
- A permanently open but idle WebSocket does not keep the sandbox alive.
- The bridge exits after three inactive hours. Modal also receives a three-hour idle timeout as a fallback.
- Every sandbox has a 24-hour absolute lifetime and every foreground shell command has a 10-minute limit.
- An inactivity shutdown is terminal until the learner explicitly presses reconnect/start; transient connection failures may reconnect automatically.
- Reload or reconnect starts a new bash process in the same live sandbox and preserves its files.
- Reset or logout terminates the named sandbox immediately. A later explicit start creates a clean workspace with no custom model.

## Non-goals

- Individual accounts, exactly-two-account enforcement, email identities, roles, recovery, OAuth, or a database.
- Persistence for `model.joblib`, code, progress, or scores after sandbox termination.
- A learning-path map, fake XP/ranks, or interactive unfinished tasks.
- Multiple exercises, hidden tests, a file explorer, or multiple Monaco tabs.
- Two-way synchronization from terminal file edits back into Monaco.
- Persistent tmux-style shells across reconnects.
- Internet package installation from the terminal.
- Per-user quotas, collaboration, GPUs, or nanoGPT training in v0.

## Definition of done

`Authenticate before lab content renders → Open the protected lesson without starting compute → Compare programming with ML → Learn every term before use → Explore data in four views → Predict supplied and drawn digits → Follow action-and-purpose coding steps and navigable hints → Explicitly start compute → Train and score solution.py → Unlock and inspect predictions from My model → Reset to starter state or terminate on logout/inactivity`
