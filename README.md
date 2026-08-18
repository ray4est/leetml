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

Create the local environment file and add a Modal token created in your Modal workspace settings:

```bash
cp .env.example .env.local
```

```dotenv
MODAL_TOKEN_ID=your-token-id
MODAL_TOKEN_SECRET=your-token-secret
```

Do not commit `.env.local` or share its values.

Build and publish the pinned Python runtime before the first execution:

```bash
npm run modal:prepare
```

Start the application:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), edit `solution.py`, and select **Run tests**.

## Runtime behavior

`POST /api/run` accepts a JSON object containing a non-empty `code` string. The server creates a fresh Modal Sandbox, writes the solution and public pytest file, runs the tests, collects the output, and terminates the sandbox.

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
