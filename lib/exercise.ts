export const logisticRegressionExercise = {
  id: "logistic-regression-basics",
  eyebrow: "Classification · Beginner",
  title: "Train a logistic classifier",
  description:
    "Build a binary classifier from the supplied training data, then return one prediction for every row in the test data. The test dataset is deterministic so every run is reproducible.",
  functionSignature: "train_and_predict(X_train, y_train, X_test)",
  requirements: [
    "Fit a scikit-learn LogisticRegression model.",
    "Return a one-dimensional prediction for every X_test row.",
    "Only return classes observed in y_train.",
    "Reach at least 80% accuracy on the fixed test split.",
  ],
  starterCode: `from sklearn.linear_model import LogisticRegression


def train_and_predict(X_train, y_train, X_test):
    """Train a classifier and return predictions for X_test."""
    # Write your solution here.
    raise NotImplementedError
`,
  testSource: `import numpy as np
import pytest
from sklearn.datasets import make_classification
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

from solution import train_and_predict


@pytest.fixture(scope="module")
def result():
    X, y = make_classification(
        n_samples=240,
        n_features=8,
        n_informative=6,
        n_redundant=0,
        class_sep=1.5,
        random_state=42,
    )
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=42,
        stratify=y,
    )
    predictions = np.asarray(train_and_predict(X_train, y_train, X_test))
    return predictions, y_train, y_test


def test_prediction_shape(result):
    predictions, _, y_test = result
    assert predictions.shape == y_test.shape, (
        f"Expected predictions with shape {y_test.shape}, got {predictions.shape}."
    )


def test_prediction_classes(result):
    predictions, y_train, _ = result
    assert set(np.unique(predictions)).issubset(set(np.unique(y_train))), (
        "Predictions contain a class that was not present in y_train."
    )


def test_minimum_accuracy(result):
    predictions, _, y_test = result
    accuracy = accuracy_score(y_test, predictions)
    assert accuracy >= 0.80, f"Expected accuracy >= 0.80, got {accuracy:.3f}."
`,
} as const;
