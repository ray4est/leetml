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

Open [http://localhost:3000](http://localhost:3000), edit `solution.py`, and select **Run tests**.

## Authentication

The workspace and execution API require the shared passphrase. A successful login creates a signed, HTTP-only session cookie that lasts for 30 days. The cookie uses `SameSite=Strict`, and production deployments also mark it `Secure`.

There are no individual accounts in v0. Changing `APP_ACCESS_PASSWORD` does not immediately revoke existing sessions; changing `SESSION_SECRET` invalidates every session and requires both users to sign in again.

## Runtime behavior

For an authenticated session, `POST /api/run` accepts a JSON object containing a non-empty `code` string. The server verifies authentication before parsing the submission or contacting Modal, then creates a fresh Modal Sandbox, writes the solution and public pytest file, runs the tests, collects the output, and terminates the sandbox.

Each sandbox has:

- Python 3.12 with pinned NumPy, scikit-learn, and pytest versions
- One CPU with a hard one-CPU limit
- 1 GiB reserved memory and a 2 GiB hard limit
- A 30-second execution limit
- Network access disabled
- A 100 KiB output limit

## Development checks

```bash
npm run lint
npm run build
```

The real Modal integration requires valid values in `.env.local`; a mocked execution does not satisfy the v0 definition of done.
