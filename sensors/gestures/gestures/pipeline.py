"""Camera frame -> raw sightings -> stable events and swipes on stdout. Shared by `run` and `preview`."""

from __future__ import annotations

import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass

import numpy as np

from .camera import Camera, CameraConfig
from .protocol import EventWriter
from .recognizer_canned import RecognizerConfig, Sighting
from .recognizers import CANNED, Recognizer, open_recognizer
from .stabilizer import Stabilizer, StabilizerConfig
from .swipes import SwipeConfig, SwipeDetector
from .tracker import GestureTracker


@dataclass(frozen=True)
class SensorSettings:
    camera: CameraConfig
    recognizer: RecognizerConfig
    stabilizer: StabilizerConfig
    swipes: SwipeConfig
    recognizer_mode: str = CANNED  # one of recognizers.RECOGNIZER_MODES


class GesturePipeline:
    def __init__(self, recognizer: Recognizer, tracker: GestureTracker, out: EventWriter) -> None:
        self._recognizer = recognizer
        self._tracker = tracker
        self._out = out

    def process(self, frame: np.ndarray) -> list[Sighting]:
        """Writes any stable events this frame causes; returns the raw sightings for drawing."""
        ts = now_ms()
        sightings = self._recognizer.detect(frame, ts)
        self._out.gestures(self._tracker.update(ts, sightings))
        return sightings

    def holds(self) -> dict[str, str]:
        return self._tracker.holds()

    def close(self) -> None:
        self._out.gestures(self._tracker.close(now_ms()))


@contextmanager
def open_pipeline(settings: SensorSettings, out: EventWriter) -> Iterator[tuple[Camera, GesturePipeline]]:
    """Opens the camera and recognizer; on exit, ends any held gesture before closing them."""
    with Camera(settings.camera) as cam, open_recognizer(settings.recognizer_mode, settings.recognizer) as recognizer:
        tracker = GestureTracker(Stabilizer(settings.stabilizer), SwipeDetector(settings.swipes))
        pipeline = GesturePipeline(recognizer, tracker, out)
        try:
            yield cam, pipeline
        finally:
            pipeline.close()


def now_ms() -> int:
    return time.time_ns() // 1_000_000
