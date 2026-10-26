import io
import json

import numpy as np

from gestures.landmarks import LANDMARK_COUNT, Hand
from gestures.pipeline import GesturePipeline
from gestures.protocol import EventWriter
from gestures.recognizer_canned import Sighting
from gestures.stabilizer import Stabilizer, StabilizerConfig
from gestures.swipes import SwipeConfig, SwipeDetector
from gestures.tracker import GestureTracker

FRAME = np.zeros((4, 4, 3), dtype=np.uint8)
PALM = Sighting(Hand("right", 0.95, ((0.5, 0.5, 0.0),) * LANDMARK_COUNT), "open_palm", 0.9)


class FakeRecognizer:
    def detect(self, frame_bgr: np.ndarray, timestamp_ms: int) -> list[Sighting]:
        return [PALM]


def a_pipeline() -> tuple[GesturePipeline, io.StringIO]:
    stream = io.StringIO()
    instant = GestureTracker(Stabilizer(StabilizerConfig(min_hold_ms=0)), SwipeDetector(SwipeConfig()))
    return GesturePipeline(FakeRecognizer(), instant, EventWriter(stream)), stream


def phases(stream: io.StringIO) -> list[str]:
    return [json.loads(line)["phase"] for line in stream.getvalue().splitlines()]


def test_process_returns_the_raw_sightings() -> None:
    pipeline, _ = a_pipeline()
    assert pipeline.process(FRAME) == [PALM]


def test_process_writes_stable_events() -> None:
    pipeline, stream = a_pipeline()
    pipeline.process(FRAME)
    assert phases(stream) == ["start"]


def test_close_writes_the_end_of_open_holds() -> None:
    pipeline, stream = a_pipeline()
    pipeline.process(FRAME)
    pipeline.close()
    assert phases(stream) == ["start", "end"]
