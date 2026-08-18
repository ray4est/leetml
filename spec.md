# Technical Specification

## Technical stack

- **Application framework:** Next.js App Router and React
- **Application language:** TypeScript on Node.js 22+
- **Code editor:** Monaco Editor
- **Terminal:** xterm.js
- **Runtime and execution environment:** Modal Sandboxes
- **Sandbox language and packages:** Python 3.12, NumPy, scikit-learn, and pytest
- **Styling:** CSS Modules and global CSS tokens
- **State:** Local React state; no database in v0

## Responsibilities

- Monaco Editor provides browser-based source-code editing.
- xterm.js provides the terminal UI and displays process output; v0 uses it as a read-only console.
- Modal Sandboxes provide isolated execution, pre-installed Python packages, test-suite execution, and CPU/GPU compute for scikit-learn and small-model training workloads.

## v0 scope

The v0 is one complete coding-and-testing loop for a single hard-coded scikit-learn exercise.

### User flow

1. Open the exercise and its starter code.
2. Edit `solution.py` in Monaco Editor.
3. Click **Run tests**.
4. The backend creates a fresh Modal Sandbox and runs the submission with pytest.
5. stdout, stderr, and the test results appear in xterm.js.
6. The application displays pass or fail and terminates the sandbox.

### Included

- A single page with Monaco Editor and xterm.js side by side.
- One hard-coded scikit-learn exercise with starter code.
- One public pytest test file.
- A Modal image with pinned versions of Python, scikit-learn, and pytest.
- One backend execution endpoint.
- A 30-second execution timeout.
- A disabled **Run tests** button while execution is in progress.
- Basic execution and infrastructure error reporting.
- xterm.js used as a read-only output console. The complete output may be appended after execution finishes; live streaming is not required for v0.

### Exercise

Implement a function that trains a `LogisticRegression` classifier and returns predictions for a fixed toy dataset. Tests verify:

- The output has the expected shape.
- Predictions contain valid classes.
- Predictions meet a minimum accuracy threshold.

### Non-goals

- Authentication or user accounts.
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

`Edit code → Run tests → Modal executes pytest → Output appears in xterm.js → Pass/fail appears`
