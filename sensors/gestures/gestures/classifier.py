"""A trained gesture classifier: feature rows in, the likeliest label and its probability out."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import joblib
import numpy as np

from .landmarks import FEATURE_VERSION


class Estimator(Protocol):
    """The part of a fitted scikit-learn classifier this module uses."""

    classes_: np.ndarray

    def predict_proba(self, rows: np.ndarray) -> np.ndarray: ...


@dataclass(frozen=True)
class GestureModel:
    estimator: Estimator

    @property
    def labels(self) -> list[str]:
        return [str(label) for label in self.estimator.classes_]

    def classify(self, rows: np.ndarray) -> list[tuple[str, float]]:
        """For each feature row, the likeliest label and its probability."""
        probabilities = self.estimator.predict_proba(rows)
        best = probabilities.argmax(axis=1)
        return [(self.labels[index], float(row[index])) for index, row in zip(best, probabilities, strict=True)]

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"estimator": self.estimator, "labels": self.labels, "feature_version": FEATURE_VERSION}, path)


def load_model(path: Path) -> GestureModel:
    if not path.exists():
        raise RuntimeError(f"No custom gesture model at {path}. Train one first: python -m gestures train")
    saved = joblib.load(path)
    if saved.get("feature_version") != FEATURE_VERSION:
        raise RuntimeError(f"{path} was trained on other features. Retrain it: python -m gestures train")
    return GestureModel(saved["estimator"])
