export const MODEL_ARTIFACT_NAME = "model.joblib";
export const MODEL_METADATA_NAME = "model-meta.json";
export const TRAIN_MODEL_COMMAND =
  "rm -f model.joblib model-meta.json && python solution.py && python evaluate_model.py";

const completeCode = `from joblib import dump
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier


# Each image is one row of 64 pixel brightness values.
digits = load_digits()
X_train, X_test, y_train, y_test = train_test_split(
    digits.data,
    digits.target,
    test_size=0.25,
    random_state=42,
    stratify=digits.target,
)

# Training stores useful patterns inside the model.
model = KNeighborsClassifier(n_neighbors=3, weights="distance")
model.fit(X_train, y_train)

# Save the trained model so the playground can use it later.
dump(model, "model.joblib")
print(f"Trained on {len(X_train)} labelled images.")
`;

export const handwrittenDigitExercise = {
  id: "handwritten-digit-lab-v2",
  title: "Train your own digit reader",
  starterCode: `from joblib import dump
from sklearn.datasets import load_digits
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier


digits = load_digits()

# TODO 1: Split digits.data and digits.target into training and test sets.

# TODO 2: Create a classifier and teach it with model.fit(...).

# TODO 3: Save the trained model as "model.joblib".

raise NotImplementedError("Finish the three training steps, then run again.")
`,
  completeCode,
  hints: [
    {
      title: "Hint 1 · Make practice and quiz piles",
      body:
        "Split the labelled images into training data the model may study and test data it must not see while learning. Use the same random_state and stratify values so your score is comparable.",
      code: `X_train, X_test, y_train, y_test = train_test_split(
    digits.data,
    digits.target,
    test_size=0.25,
    random_state=42,
    stratify=digits.target,
)`,
    },
    {
      title: "Hint 2 · Teach, then save",
      body:
        "A classifier starts with an algorithm but no knowledge of these images. fit gives it pixels and answers; dump preserves the learned model for the playground.",
      code: `model = KNeighborsClassifier(n_neighbors=3, weights="distance")
model.fit(X_train, y_train)
dump(model, "model.joblib")`,
    },
    {
      title: "Hint 3 · Complete solution",
      body:
        "This is one complete solution. Copy it, run it, then experiment with n_neighbors or a different scikit-learn classifier.",
      code: completeCode,
    },
  ],
  evaluatorSource: `import json
import os
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from joblib import load
from sklearn.datasets import load_digits
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split


MODEL_PATH = Path("model.joblib")
METADATA_PATH = Path("model-meta.json")

if not MODEL_PATH.is_file():
    raise SystemExit("Training finished without creating model.joblib. Use joblib.dump to save it.")

digits = load_digits()
_, X_test, _, y_test = train_test_split(
    digits.data,
    digits.target,
    test_size=0.25,
    random_state=42,
    stratify=digits.target,
)

model = load(MODEL_PATH)
predictions = np.asarray(model.predict(X_test))
if predictions.shape != y_test.shape:
    raise SystemExit(f"Expected {len(y_test)} predictions, received shape {predictions.shape}.")
if not np.issubdtype(predictions.dtype, np.integer):
    raise SystemExit("The model must predict integer digits.")
unexpected = sorted(set(np.unique(predictions)) - set(range(10)))
if unexpected:
    raise SystemExit(f"The model predicted values outside 0–9: {unexpected}.")

accuracy = float(accuracy_score(y_test, predictions))
metadata = {
    "accuracy": accuracy,
    "trainedAt": datetime.now(timezone.utc).isoformat(),
}
temporary_path = METADATA_PATH.with_suffix(".tmp")
temporary_path.write_text(json.dumps(metadata), encoding="utf-8")
os.replace(temporary_path, METADATA_PATH)

print("\\nModel ready for the playground!")
print(f"Accuracy on 450 unseen images: {accuracy:.1%}")
print("Choose My model above and try to fool it with your handwriting.")
`,
  predictorSource: `import json
import sys
from pathlib import Path

import numpy as np
from joblib import load


MODEL_PATH = Path("model.joblib")
if not MODEL_PATH.is_file():
    raise SystemExit("model.joblib does not exist")

pixels = json.loads(sys.argv[1])
values = np.asarray(pixels, dtype=float)
if values.shape != (64,) or not np.all(np.isfinite(values)):
    raise SystemExit("expected 64 finite pixel values")
if np.any(values < 0) or np.any(values > 16):
    raise SystemExit("pixel values must be between 0 and 16")

model = load(MODEL_PATH)
prediction = np.asarray(model.predict(values.reshape(1, -1)))
if prediction.size != 1:
    raise SystemExit("model did not return exactly one prediction")
digit = int(prediction.reshape(-1)[0])
if digit not in range(10):
    raise SystemExit("model prediction was not a digit from 0 through 9")

payload = {"digit": digit}
if all(hasattr(model, attribute) for attribute in ("kneighbors", "_fit_X", "_y")):
    distances, indexes = model.kneighbors(values.reshape(1, -1), n_neighbors=3)
    fitted_pixels = np.asarray(model._fit_X)
    fitted_labels = np.asarray(model._y)
    classes = np.asarray(getattr(model, "classes_", []))
    neighbors = []
    for distance, index in zip(distances[0], indexes[0]):
        neighbor_pixels = np.asarray(fitted_pixels[index], dtype=float)
        encoded_label = int(np.asarray(fitted_labels[index]).reshape(-1)[0])
        neighbor_label = int(classes[encoded_label]) if classes.size else encoded_label
        if neighbor_pixels.shape == (64,) and neighbor_label in range(10):
            neighbors.append({
                "label": neighbor_label,
                "pixels": neighbor_pixels.tolist(),
                "distance": float(distance),
            })
    if len(neighbors) == 3:
        payload["neighbors"] = neighbors

print(json.dumps(payload, separators=(",", ":")))
`,
} as const;
