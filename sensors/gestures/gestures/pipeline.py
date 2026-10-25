"""Camera frame -> raw sightings -> stable events on stdout. Shared by `run` and `preview`."""

from __future__ import annotations

import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Protocol

import numpy as np

from .camera import Camera, CameraConfig
from .models import gesture_recognizer_model
from .protocol import EventWriter
from .recognizer_canned import CannedRecognizer, RecognizerConfig, Sighting
from .stabilizer import Stabilizer, StabilizerConfig


@dataclass(frozen=True)
class SensorSettings:
    camera: CameraConfig
    recognizer: RecognizerConfig
    stabilizer: StabilizerConfig


class Recognizer(Protocol):
    def detect(self, frame_bgr: np.ndarray, timestamp_ms: int) -> list[Sighting]: ...


class GesturePipeline:
    def __init__(self, recognizer: Recognizer, stabilizer: Stabilizer, out: EventWriter) -> None:
        self._recognizer = recognizer
        self._stabilizer = stabilizer
        self._out = out

    def process(self, frame: np.ndarray) -> list[Sighting]:
        """Writes any stable events this frame causes; returns the raw sightings for drawing."""
        ts = _now_ms()
        sightings = self._recognizer.detect(frame, ts)
        self._out.gestures(self._stabilizer.update(ts, sightings))
        return sightings

    def holds(self) -> dict[str, str]:
        return self._stabilizer.holds()

    def close(self) -> None:
        self._out.gestures(self._stabilizer.close(_now_ms()))


@contextmanager
def open_pipeline(settings: SensorSettings, out: EventWriter) -> Iterator[tuple[Camera, GesturePipeline]]:
    """Opens the camera and recognizer; on exit, ends any held gesture before closing them."""
    model = gesture_recognizer_model()
    with Camera(settings.camera) as cam, CannedRecognizer(model, settings.recognizer) as recognizer:
        pipeline = GesturePipeline(recognizer, Stabilizer(settings.stabilizer), out)
        try:
            yield cam, pipeline
        finally:
            pipeline.close()


def _now_ms() -> int:
    return time.time_ns() // 1_000_000
