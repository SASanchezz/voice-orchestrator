import io
import threading
from collections.abc import Iterator

import numpy as np

from gestures.pipeline import GesturePipeline
from gestures.protocol import EventWriter
from gestures.recognizer_canned import Sighting
from gestures.run import process_until
from gestures.stabilizer import Stabilizer, StabilizerConfig
from gestures.swipes import SwipeConfig, SwipeDetector
from gestures.tracker import GestureTracker

FRAME = np.zeros((4, 4, 3), dtype=np.uint8)


class CountingRecognizer:
    def __init__(self) -> None:
        self.frames = 0

    def detect(self, frame_bgr: np.ndarray, timestamp_ms: int) -> list[Sighting]:
        self.frames += 1
        return []


def frames_stopping_after(count: int, stop: threading.Event) -> Iterator[np.ndarray]:
    """Endless frames, like a camera; the stop signal arrives after `count` of them."""
    sent = 0
    while True:
        yield FRAME
        sent += 1
        if sent == count:
            stop.set()


def test_frames_after_the_stop_signal_are_not_processed() -> None:
    recognizer = CountingRecognizer()
    tracker = GestureTracker(Stabilizer(StabilizerConfig()), SwipeDetector(SwipeConfig()))
    pipeline = GesturePipeline(recognizer, tracker, EventWriter(io.StringIO()))
    stop = threading.Event()
    process_until(frames_stopping_after(3, stop), pipeline, stop)
    assert recognizer.frames == 3
