"""Which recognizer the sensor runs: MediaPipe's built-in gestures, your trained ones, or both."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Protocol

import numpy as np

from .classifier import load_model
from .models import custom_model_path, gesture_recognizer_model
from .recognizer_canned import CannedRecognizer, RecognizerConfig, Sighting
from .recognizer_custom import CustomRecognizer, trained_only, trained_when_confident

CANNED = "canned"
CHOICES = {"custom": trained_only, "both": trained_when_confident}
RECOGNIZER_MODES = (CANNED, *CHOICES)


class Recognizer(Protocol):
    def detect(self, frame_bgr: np.ndarray, timestamp_ms: int) -> list[Sighting]: ...


@contextmanager
def open_recognizer(mode: str, cfg: RecognizerConfig) -> Iterator[Recognizer]:
    """The built-in recognizer also finds the hands the trained classifier looks at, so it always runs."""
    with CannedRecognizer(gesture_recognizer_model(), cfg) as canned:
        if mode == CANNED:
            yield canned
            return
        yield CustomRecognizer(canned, load_model(custom_model_path()), CHOICES[mode])
