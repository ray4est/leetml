export const handwrittenDigitExercise = {
  id: "handwritten-digit-reader",
  eyebrow: "Image classification · Beginner",
  title: "Build a handwritten digit reader",
  description:
    "A parcel sorter needs to read handwritten bin numbers from 0 to 9. Train a model on tiny 8 × 8 grayscale images, then predict the digit shown in every new image.",
  functionSignature: "predict_digits(X_train, y_train, X_test)",
  requirements: [
    "Fit a scikit-learn classifier using the supplied 64-pixel training rows.",
    "Return one prediction for every X_test image.",
    "Only return integer digit labels from 0 through 9.",
    "Reach at least 96% accuracy on the fixed test split.",
  ],
  tip: "Start with three neighbours. Then compare different n_neighbors values and uniform versus distance weights.",
  sampleLabel: 0,
  sampleImage: [
    0, 0, 5, 13, 9, 1, 0, 0,
    0, 0, 13, 15, 10, 15, 5, 0,
    0, 3, 15, 2, 0, 11, 8, 0,
    0, 4, 12, 0, 0, 8, 8, 0,
    0, 5, 8, 0, 0, 9, 8, 0,
    0, 4, 11, 0, 1, 12, 7, 0,
    0, 2, 14, 5, 10, 12, 0, 0,
    0, 0, 6, 13, 10, 0, 0, 0,
  ],
  starterCode: `from sklearn.neighbors import KNeighborsClassifier


def predict_digits(X_train, y_train, X_test):
    """Train a recognizer and predict one digit for each test image."""
    model = KNeighborsClassifier(n_neighbors=3)

    # Teach the model using the labelled training images.
    # Then return its predictions for X_test.
    raise NotImplementedError
`,
  testSource: `from collections import Counter

import numpy as np
import pytest
from sklearn.datasets import load_digits
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

from solution import predict_digits


PIXEL_CHARS = " .:-=+*#%@"
TARGET_ACCURACY = 0.96


def render_digit(flat_image):
    image = np.asarray(flat_image).reshape(8, 8)
    levels = np.rint(image / 16 * (len(PIXEL_CHARS) - 1)).astype(int)
    return "\\n".join("".join(PIXEL_CHARS[level] * 2 for level in row) for row in levels)


def print_feedback(X_test, y_test, predictions, accuracy):
    print("\\nDigit reader feedback")
    print(f"Accuracy: {accuracy:.1%}  ·  Target: {TARGET_ACCURACY:.0%}")

    mistakes = np.flatnonzero(predictions != y_test)
    if mistakes.size == 0:
        print("Perfect score — no misclassified digits to inspect.")
        return

    pairs = Counter((int(y_test[index]), int(predictions[index])) for index in mistakes)
    (actual, predicted), count = pairs.most_common(1)[0]
    print(f"Most confused pair: actual {actual} → predicted {predicted} ({count} times)")
    print("\\nThree mistakes to inspect:")

    for index in mistakes[:3]:
        print(f"\\nActual {int(y_test[index])} → predicted {int(predictions[index])}")
        print(render_digit(X_test[index]))


@pytest.fixture(scope="module")
def result():
    digits = load_digits()
    X_train, X_test, y_train, y_test = train_test_split(
        digits.data,
        digits.target,
        test_size=0.25,
        random_state=42,
        stratify=digits.target,
    )
    original_inputs = tuple(array.copy() for array in (X_train, X_test, y_train))
    predictions = np.asarray(predict_digits(X_train, y_train, X_test))
    inputs_unchanged = all(
        np.array_equal(current, original)
        for current, original in zip((X_train, X_test, y_train), original_inputs)
    )
    return predictions, X_test, y_test, inputs_unchanged


def test_one_prediction_per_image(result):
    predictions, _, y_test, _ = result
    assert predictions.shape == y_test.shape, (
        f"Expected one prediction per image: shape {y_test.shape}. "
        f"Your result has shape {predictions.shape}."
    )


def test_predictions_are_digits(result):
    predictions, _, _, _ = result
    assert np.issubdtype(predictions.dtype, np.integer), (
        f"Predictions must be integer digits, but the result dtype is {predictions.dtype}."
    )
    unexpected = sorted(set(np.unique(predictions)) - set(range(10)))
    assert not unexpected, f"Predictions contain values outside 0–9: {unexpected}."


def test_inputs_are_not_changed(result):
    _, _, _, inputs_unchanged = result
    assert inputs_unchanged, "Do not modify X_train, y_train, or X_test in place."


def test_minimum_accuracy(result):
    predictions, X_test, y_test, _ = result
    accuracy = accuracy_score(y_test, predictions)
    print_feedback(X_test, y_test, predictions, accuracy)
    assert accuracy >= TARGET_ACCURACY, (
        f"Your reader reached {accuracy:.1%}; the target is {TARGET_ACCURACY:.0%}. "
        "Inspect the mistakes above, then try changing the model or its settings."
    )
`,
} as const;
