"""A wake word model trained here (`python -m wake train`, or the web UI's Train wake word dialog): a small classifier
on openWakeWord's speech embeddings, saved with joblib."""

from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
from sklearn.pipeline import Pipeline

from .stream import FeatureStream

WAKE_CLASS = 1
# the stream starts from made-up noise; as openWakeWord does, its first scores aren't trusted
WARM_UP_FRAMES = 5
# how sure a model trained here must be to wake: checked across your recordings, 0.8 and up keeps your other talk and
# your quiet room from waking it, and still hears the wake word
TRAINED_THRESHOLD = 0.8


class TrainedWakeWord:
    """The classifier, and the name it is listened for by: "hey_oracle" is said "hey oracle"."""

    def __init__(self, classifier: Pipeline, name: str) -> None:
        self.classifier = classifier
        self.name = name

    def probabilities(self, windows: np.ndarray) -> np.ndarray:
        return self.classifier.predict_proba(windows)[:, WAKE_CLASS]

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"classifier": self.classifier, "name": self.name}, path)

    @staticmethod
    def load(path: Path) -> TrainedWakeWord:
        saved = joblib.load(path)
        return TrainedWakeWord(saved["classifier"], saved["name"])


class TrainedWakeWordDetector:
    """How sure the trained model is that the wake word just ended, from 0 to 1."""

    def __init__(self, model: TrainedWakeWord, stream: FeatureStream) -> None:
        self._model = model
        self._stream = stream
        self._frames = 0

    @property
    def name(self) -> str:
        return self._model.name

    @property
    def threshold(self) -> float:
        return TRAINED_THRESHOLD

    def score(self, frame: np.ndarray) -> float:
        window = self._stream.window_after(frame)
        self._frames += 1
        if self._frames <= WARM_UP_FRAMES:
            return 0.0
        return float(self._model.probabilities(window[None, :])[0])

    def reset(self) -> None:
        self._stream.reset()
        self._frames = 0
