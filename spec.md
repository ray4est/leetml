# Technical Specification

## Technical stack

- **Application framework:** Next.js App Router and React
- **Application language:** TypeScript on Node.js 22+
- **Code editor:** Monaco Editor
- **Terminal:** xterm.js
- **Runtime and execution environment:** Modal Sandboxes
- **Sandbox language and packages:** Python 3.12, NumPy, scikit-learn, and pytest
- **Authentication:** Shared passphrase with HMAC-SHA256 signed, HTTP-only sessions
- **Cryptography:** Node.js built-in `crypto`; no authentication service or database
- **Styling:** CSS Modules and global CSS tokens
- **State:** Local React state; no database in v0

## Responsibilities

- Monaco Editor provides browser-based source-code editing.
- xterm.js provides the terminal UI and displays process output; v0 uses it as a read-only console.
- Modal Sandboxes provide isolated execution, pre-installed Python packages, test-suite execution, and CPU/GPU compute for scikit-learn and small-model training workloads.

## v0 scope

The v0 is one complete coding-and-testing loop for a single hard-coded scikit-learn exercise.

### User flow

1. Enter the shared family passphrase.
2. Open the exercise and its starter code.
3. Edit `solution.py` in Monaco Editor.
4. Click **Run tests**.
5. The backend verifies the session, creates a fresh Modal Sandbox, and runs the submission with pytest.
6. stdout, stderr, and the test results appear in xterm.js.
7. The application displays pass or fail and terminates the sandbox.

### Included

- A single page with Monaco Editor and xterm.js side by side.
- One hard-coded scikit-learn exercise with starter code.
- One public pytest test file.
- A Modal image with pinned versions of Python, scikit-learn, and pytest.
- One backend execution endpoint.
- A shared-passphrase login for exactly two trusted users.
- A signed 30-day session and a sign-out action.
- Authentication checks on both the workspace page and execution endpoint.
- A 30-second execution timeout.
- A disabled **Run tests** button while execution is in progress.
- Basic execution and infrastructure error reporting.
- xterm.js used as a read-only output console. The complete output may be appended after execution finishes; live streaming is not required for v0.

### Exercise

Implement a function that trains a `LogisticRegression` classifier and returns predictions for a fixed toy dataset. Tests verify:

- The output has the expected shape.
- Predictions contain valid classes.
- Predictions meet a minimum accuracy threshold.

### Minimal authentication design

- `APP_ACCESS_PASSWORD` stores a unique shared passphrase of at least 20 characters.
- `SESSION_SECRET` stores at least 32 random bytes used to sign sessions.
- The passphrase is submitted only to `POST /api/login`, limited to 256 characters, checked with a timing-safe comparison, and never placed in a cookie.
- Login and logout POST requests must be same-origin.
- A successful login sets `leetml_session` to `v1.<expiry>.<nonce>.<signature>`, where the signature is HMAC-SHA256 over the preceding fields.
- Sessions expire after 30 days. The cookie is `HttpOnly`, `SameSite=Strict`, `Path=/`, high priority, and `Secure` in production.
- The home page redirects unauthenticated visitors to `/login` before rendering the editor.
- `POST /api/run` returns `401` before parsing code or contacting Modal when the session is absent, expired, or invalid.
- Missing or weak authentication environment variables fail closed with `503` from authentication-sensitive API routes.
- The client redirects to `/login?reason=expired` if its session expires during a run.

### Authentication non-goals

- Individual identities, email addresses, roles, or account recovery.
- OAuth, magic links, an authentication provider, a database, or Redis.
- Password reset UI, session management UI, CAPTCHA, or per-user quotas.
- Immediate session revocation when only the passphrase changes. Rotating `SESSION_SECRET` revokes all sessions.

### Other non-goals

- A database or saved submissions.
- Multiple exercises.
- Hidden tests.
- A file explorer or multiple editable files.
- An interactive terminal or PTY.
- User-installed packages.
- Persistent sandboxes.
- GPU execution or nanoGPT training.
- Collaboration, billing, deployment, or usage quotas.

### Definition of done

The following loop works reliably:

`Sign in → Edit code → Run tests → Modal executes pytest → Output appears in xterm.js → Pass/fail appears → Sign out`
