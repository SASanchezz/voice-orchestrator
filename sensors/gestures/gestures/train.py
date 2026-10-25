"""`python -m gestures train`: trains the custom classifier on data/*.csv, reports how well it does, saves it.

It's scored on a held-out part of the samples, then trained again on all of them for the saved model.
"""

from __future__ import annotations

import sys
from collections.abc import Callable
from pathlib import Path
from typing import TextIO

import numpy as np
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.preprocessing import StandardScaler

from .classifier import GestureModel
from .events import NO_GESTURE
from .samples import Samples, load_samples

TEST_SHARE = 0.2
SEED = 0  # the same split and weights every run, so two runs can be compared
MIN_SAMPLES_PER_CLASS = 5


def mlp() -> Pipeline:
    return make_pipeline(StandardScaler(), MLPClassifier((64, 32), max_iter=1000, random_state=SEED))


def knn() -> Pipeline:
    return make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=5))


ESTIMATORS: dict[str, Callable[[], Pipeline]] = {"mlp": mlp, "knn": knn}


def train(data_dir: Path, model_path: Path, estimator: str, report: TextIO = sys.stdout) -> GestureModel:
    samples = load_samples(data_dir)
    _check(samples, report)
    _evaluate(ESTIMATORS[estimator](), samples, report)
    model = GestureModel(ESTIMATORS[estimator]().fit(samples.rows, samples.labels))
    model.save(model_path)
    print(f"Saved {model_path} ({', '.join(model.labels)})", file=report)
    return model


def _check(samples: Samples, report: TextIO) -> None:
    counts = samples.counts()
    print("Samples: " + ", ".join(f"{label} {count}" for label, count in counts.items()), file=report)
    if len(counts) < 2:
        raise RuntimeError("Need at least two gestures to train; record `none` and one more.")
    too_few = [label for label, count in counts.items() if count < MIN_SAMPLES_PER_CLASS]
    if too_few:
        raise RuntimeError(f"Too few samples (< {MIN_SAMPLES_PER_CLASS}) for: {', '.join(too_few)}")
    if NO_GESTURE not in counts:
        print(f"Warning: no `{NO_GESTURE}` samples, so any hand will look like one of your gestures.", file=report)


def _evaluate(estimator: Pipeline, samples: Samples, report: TextIO) -> None:
    train_rows, test_rows, train_labels, test_labels = train_test_split(
        samples.rows, samples.labels, test_size=TEST_SHARE, stratify=samples.labels, random_state=SEED
    )
    predicted = estimator.fit(train_rows, train_labels).predict(test_rows)
    accuracy = float(np.mean(predicted == test_labels))
    print(f"\nValidation accuracy: {accuracy:.1%} on {len(test_labels)} held-out samples\n", file=report)
    print(classification_report(test_labels, predicted, zero_division=0), file=report)
    _print_confusion(test_labels, predicted, report)


def _print_confusion(expected: np.ndarray, predicted: np.ndarray, report: TextIO) -> None:
    labels = sorted(set(expected) | set(predicted))
    matrix = confusion_matrix(expected, predicted, labels=labels)
    width = max(len(str(label)) for label in labels) + 2
    print("Confusion matrix (rows: shown, columns: recognized):", file=report)
    print(" " * width + "".join(f"{label:>{width}}" for label in labels), file=report)
    for label, row in zip(labels, matrix, strict=True):
        print(f"{label:>{width}}" + "".join(f"{count:>{width}}" for count in row), file=report)
