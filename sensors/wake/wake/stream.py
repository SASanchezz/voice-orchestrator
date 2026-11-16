"""openWakeWord's speech embeddings, one 80 ms frame at a time: what a trained wake word model looks at. Training and
listening both go through this, so a model is trained on exactly what it will see live."""

from __future__ import annotations

import numpy as np
from openwakeword.utils import AudioFeatures

WINDOW_FRAMES = 16  # 1.28 s of embeddings, as openWakeWord's own wake word models take
EMBEDDING_SIZE = 96
WINDOW_SIZE = WINDOW_FRAMES * EMBEDDING_SIZE


class FeatureStream:
    def __init__(self) -> None:
        self._features = AudioFeatures(inference_framework="onnx")

    def window_after(self, frame: np.ndarray) -> np.ndarray:
        """The last 1.28 s of embeddings once `frame` is added, flattened to one row."""
        self._features(frame)
        return self._features.get_features(WINDOW_FRAMES).reshape(WINDOW_SIZE)

    def reset(self) -> None:
        self._features.reset()
