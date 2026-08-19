# LeetML

LeetML v0 is one interactive handwritten-digit lesson. A learner can explore a ready-made model, draw digits, edit Python in Monaco, train a scikit-learn model in a private Modal Sandbox, and use that model in the same playground.

## Prerequisites

- Node.js 22 or newer
- npm
- A Modal account and API token

## Setup

Install dependencies and create the local environment file:

```bash
npm install
cp .env.example .env.local
```

Configure all four values:

```dotenv
APP_ACCESS_PASSWORD=a-unique-passphrase-at-least-20-characters-long
SESSION_SECRET=a-random-secret-containing-at-least-32-bytes
MODAL_TOKEN_ID=your-token-id
MODAL_TOKEN_SECRET=your-token-secret
```

Generate `SESSION_SECRET` separately from the family passphrase, for example with `openssl rand -base64 32`. Share only `APP_ACCESS_PASSWORD` with the two trusted learners. Do not commit `.env.local`; add the same four values to the production host as secrets.

Build and publish the pinned Python runtime before the first lab session:

```bash
npm run modal:prepare
```

Start the application and open [http://localhost:3000](http://localhost:3000):

```bash
npm run dev
```

## Lesson behavior

The single page has three sections:

1. **Problem** challenges the learner to imagine handwritten rules for recognizing every possible digit, explains `X`, `y`, and the train/test split through a study-and-quiz analogy, then introduces three-nearest-neighbours.
2. **Playground** offers 20 held-out digit images and a direct 8 × 8 pixel drawing canvas. The built-in distance-weighted `KNeighborsClassifier` equivalent runs entirely in the browser, so it is public and does not spend Modal budget. Every built-in prediction reveals the three closest labelled study digits; a prediction on a supplied quiz image also reveals its true label.
3. **Do it yourself** provides an editable Monaco editor, three progressive hints, and a terminal below it. The final hint can be copied or inserted as a complete solution.

Selecting **Start lab** or **Train my model** is the first action that can provision Modal. Training saves Monaco to `/workspace/solution.py` and sends this command through xterm.js:

```bash
rm -f model.joblib model-meta.json && python solution.py && python evaluate_model.py
```

`solution.py` must save an object with a usable `predict` method as `model.joblib`. The evaluator tests it on the deterministic 450-image test split, validates its output, writes `model-meta.json`, and prints its accuracy. A valid artifact immediately unlocks **My model** in the playground. The supplied K-nearest-neighbours solution scores about 98.4%.

The terminal remains a normal bash shell in `/workspace`. Monaco is the source of truth for `solution.py`: pressing **Train my model** overwrites that file with the current editor buffer. Shell edits do not flow back into Monaco.

## Authentication and budget protection

The explanation, built-in playground, drawing canvas, editor, and hints are public. Terminal access, source saving, training, model status, and custom-model predictions require the shared family passphrase.

A successful login creates a signed HTTP-only cookie lasting 30 days. It uses `SameSite=Strict` and is also `Secure` in production. The shared-passphrase design does not create individual identities or enforce a literal two-account limit; budget protection depends on keeping the passphrase private.

Only `/#do-it-yourself` is accepted as a post-login return target. External or malformed destinations fall back to `/`. Changing `APP_ACCESS_PASSWORD` does not revoke cookies already issued; changing `SESSION_SECRET` invalidates all sessions.

## Runtime and lifecycle

Each authenticated browser session receives a named Modal Sandbox with:

- Python 3.12, NumPy, scikit-learn, joblib, pytest, bash, and the WebSocket bridge
- One CPU, 1 GiB reserved memory, and a 2 GiB hard limit
- No outbound network access
- A 10-minute foreground-command limit
- One-hour inactivity termination and a 24-hour absolute lifetime

Terminal input/output and custom-model predictions count as activity. Merely reading the page or using the built-in browser model does not. The sandbox and `model.joblib` disappear after one inactive hour, infrastructure failure, the absolute limit, or logout. Reconnecting during its lifetime starts a fresh bash process but preserves its files.

Only one terminal connection is active per sandbox. A newer tab replaces the previous shell. The browser connects directly using a short-lived Modal Connect Token held only in component memory.

## Manual acceptance test

1. Open `/` signed out. Confirm the Problem, Playground, and Do it yourself sections render, and confirm the Network panel shows no request to `/api/prepare`.
2. Pick several test images with **LeetML KNN**, press **Predict digit**, and confirm each result reveals the prediction, hidden answer, and three nearest labelled study digits with distances.
3. Open **Draw your own**, paint a digit directly into the 8 × 8 grid, and confirm the exact model input appears before predicting. Clear it and confirm prediction is disabled.
4. Edit `solution.py`, reveal all three hints, and use **Use in editor**. Reload before signing in and confirm the draft remains in this tab.
5. Press **Start lab** or **Train my model**, enter the family passphrase, and confirm you return to `/#do-it-yourself` without losing the draft.
6. Press **Start lab** if needed. Wait for the colored `ray@leetml` prompt, then run `pwd`, `python --version`, and `python -c "import sklearn; print(sklearn.__version__)"`.
7. Restore the starter code and press **Train my model**. Confirm the terminal shows the `NotImplementedError` and the playground remains on the built-in model.
8. Insert the complete hint and train again. Confirm the terminal reports an accuracy near 98.4%, **My model is ready** appears, and the page returns to the Playground with **My model** selected.
9. Predict a supplied image and a drawing with **My model**. Confirm both predictions return, the trained KNN exposes three neighbours, and supplied images still reveal their true labels.
10. Change `n_neighbors`, retrain, and confirm the displayed accuracy and model timestamp update.
11. Use the terminal as a shell. Run `sleep 60`, press **Train my model**, and confirm it interrupts the foreground command before training.
12. Reload, press **Start lab**, and confirm the existing model is still available while the sandbox is alive.
13. Open a second tab and confirm it takes over the terminal. Reconnect from the first tab to take it back.
14. Visit `/tasks/handwritten-digit-reader` and confirm it redirects to `/#do-it-yourself`.
15. Sign out, confirm the lab locks, and confirm the prior custom model is gone after signing in and starting a new sandbox.

To verify network isolation, run this in the sandbox and confirm it fails:

```bash
python -c "import socket; socket.create_connection(('1.1.1.1', 53), 2)"
```

## Development checks

```bash
npm run lint
npm run build
```

The v0 definition of done includes one real Modal pass through login, preparation, training, model status, prediction, and logout; mocked execution alone is insufficient.
