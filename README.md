# Handwriting Reader Lab

Handwriting Reader Lab is one protected, interactive machine-learning lesson. A learner can explore a ready-made model, draw digits, edit Python in Monaco, train a scikit-learn model in a private Modal Sandbox, and use that model in the same playground.

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

The opening mission asks the learner to understand the concepts, train a model, test both supplied images and their own handwriting, and find at least one correct and one incorrect handwriting prediction.

The single page has three sections:

1. **Problem** compares ordinary programming with machine learning, introduces each required term, explains features and ground truth, and teaches the train/test split through a study-and-quiz analogy. An interactive data explorer shows any sample as an image, an 8 × 8 number grid, a Python array, and its answer.
2. **Playground** offers 20 held-out digit images and a direct 8 × 8 pixel drawing canvas. The built-in distance-weighted `KNeighborsClassifier` equivalent runs entirely in the browser and does not spend Modal budget. Every prediction reveals the three closest labelled study digits.
3. **Do it yourself** provides action-and-reason instructions, an editable Monaco editor, and one navigable hint at a time beside it. Copying the complete hint is allowed, but the lesson recommends typing the code while using hints as a reference. The terminal is stacked directly below the editor. **Reset lab** deletes the current sandbox, code, and trained model before restoring the complete starter state.

Selecting **Start lab** or **Train my model** is the first action that can provision Modal. Training saves Monaco to `/workspace/solution.py` and sends this command through xterm.js:

```bash
rm -f model.joblib model-meta.json && python solution.py && python evaluate_model.py
```

`solution.py` must save an object with a usable `predict` method as `model.joblib`. The evaluator tests it on the deterministic 450-image test split, validates its output, writes `model-meta.json`, and prints its accuracy. A valid artifact immediately unlocks **My model** in the playground. The supplied K-nearest-neighbours solution scores about 98.4%.

The terminal remains a normal bash shell in `/workspace`. Monaco is the source of truth for `solution.py`: pressing **Train my model** overwrites that file with the current editor buffer. Shell edits do not flow back into Monaco.

## Authentication and budget protection

The entire lab page—including the explanation, playground, editor, hints, and terminal—is protected by the shared family passphrase. An unauthenticated request to `/` is redirected to `/login` before any lab markup is rendered.

Authentication alone does not provision Modal. **Start lab** or **Train my model** remains the first action that can create or reconnect a sandbox, so viewing the protected lesson and using the built-in browser model do not spend Modal compute budget.

A successful login creates a signed HTTP-only cookie lasting 30 days. It uses `SameSite=Strict` and is also `Secure` in production. The shared-passphrase design does not create individual identities or enforce a literal two-account limit; budget protection depends on keeping the passphrase private.

The normal post-login destination is `/`; `/#do-it-yourself` is also accepted when an in-progress session expires. External or malformed destinations fall back to `/`. Changing `APP_ACCESS_PASSWORD` does not revoke cookies already issued; changing `SESSION_SECRET` invalidates all sessions.

## Runtime and lifecycle

Each authenticated browser session receives a named Modal Sandbox with:

- Python 3.12, NumPy, scikit-learn, joblib, pytest, bash, and the WebSocket bridge
- One CPU, 1 GiB reserved memory, and a 2 GiB hard limit
- No outbound network access
- A 10-minute foreground-command limit
- Three-hour inactivity termination and a 24-hour absolute lifetime

Terminal input/output and custom-model predictions count as activity. Merely reading the page or using the built-in browser model does not. The sandbox and `model.joblib` disappear after three inactive hours, infrastructure failure, the absolute limit, reset, or logout. Reconnecting during its lifetime starts a fresh bash process but preserves its files.

Only one terminal connection is active per sandbox. A newer tab replaces the previous shell. The browser connects directly using a short-lived Modal Connect Token held only in component memory.

## Manual acceptance test

1. Open `/` signed out. Confirm it redirects to `/login`, no Problem, Playground, editor, or hints content is present, and the Network panel shows no request to `/api/prepare`. Sign in and confirm **Handwriting Reader Lab** and all three lesson sections render without preparing a sandbox.
2. Confirm the top of the lesson states the full mission: understand the concepts, train a model, test sample images and personal handwriting, and find both a correct and an incorrect handwriting prediction. Then read the Problem in order and confirm machine learning, training, model, prediction, data, feature, ground truth, label, train/test data, KNN, `k`, and distance are each defined before later instructions use them.
3. In **Sample data explorer**, switch between Study data and Test data, choose several samples, and confirm each shows the image, 64 numbered grayscale features, Python array, and ground-truth answer.
4. Pick several test images with **Built-in KNN**, press **Predict digit**, and confirm each result reveals the prediction, hidden answer, and three nearest labelled study digits with distances.
5. Open **Draw your own**, paint a digit directly into the 8 × 8 grid, and confirm the exact model input appears before predicting. Clear it and confirm prediction is disabled.
6. Confirm **Hints** is horizontally aligned beside the editor, only one hint appears at a time, and **Previous hint** and **Next hint** navigate all three. Confirm the instructions allow copying but recommend typing from the hint. On the final hint, use **Use in editor**. Reload and confirm the draft remains in this tab.
7. Confirm the terminal is stacked below the editor, rather than below the Hints column.
8. Press **Start lab** or **Train my model** and confirm this is the first action that requests `/api/prepare`.
9. Press **Start lab** if needed. Wait for the colored `ray@leetml` prompt, then run `pwd`, `python --version`, and `python -c "import sklearn; print(sklearn.__version__)"`.
10. Restore the starter code and press **Train my model**. Confirm the terminal shows the `NotImplementedError` and the playground remains on the built-in model.
11. Insert the complete hint and train again. Confirm the terminal reports an accuracy near 98.4%, **My model is ready** appears, and the page returns to the Playground with **My model** selected.
12. Predict a supplied image and a drawing with **My model**. Confirm both predictions return, the trained KNN exposes three neighbours, and supplied images still reveal their true labels.
13. Change `n_neighbors`, retrain, and confirm the displayed accuracy and model timestamp update.
14. Select **Reset lab**, confirm the warning, and verify the terminal closes, the editor returns to starter code with a fresh undo history, Hints returns to the first hint, drawings/results clear, and **My model** locks. Start again and confirm the old files are absent.
15. Use the terminal as a shell. Run `sleep 60`, press **Train my model**, and confirm it interrupts the foreground command before training.
16. Reload, press **Start lab**, and confirm the existing model is still available while the sandbox is alive.
17. Open a second tab and confirm it takes over the terminal. Reconnect from the first tab to take it back.
18. Visit `/tasks/handwritten-digit-reader` and confirm it redirects to `/#do-it-yourself`.
19. Sign out, confirm `/` redirects to `/login` and exposes no lab content, then sign in and start a new sandbox to confirm the prior custom model is gone.

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
