import numpy as np

from gestures.landmarks import LANDMARK_COUNT, Hand
from gestures.recognizer_canned import Sighting
from gestures.recognizer_custom import (
    CUSTOM_WINS_AT,
    Choice,
    CustomRecognizer,
    trained_only,
    trained_when_confident,
)

FRAME = np.zeros((4, 4, 3), dtype=np.uint8)
HAND = Hand("right", 0.95, tuple((i / 100, i / 50, 0.0) for i in range(LANDMARK_COUNT)))
PALM = Sighting(HAND, "open_palm", 0.9)


class FakeHands:
    def __init__(self, sightings: list[Sighting]) -> None:
        self._sightings = sightings

    def detect(self, frame_bgr: np.ndarray, timestamp_ms: int) -> list[Sighting]:
        return self._sightings


class FakeClassifier:
    def __init__(self, label: str, confidence: float) -> None:
        self._reading = (label, confidence)
        self.rows_seen = 0

    def classify(self, rows: np.ndarray) -> list[tuple[str, float]]:
        self.rows_seen += len(rows)
        return [self._reading] * len(rows)


def detect(sightings: list[Sighting], classifier: FakeClassifier, choose: Choice = trained_only) -> list[Sighting]:
    return CustomRecognizer(FakeHands(sightings), classifier, choose).detect(FRAME, 0)


def test_trained_only_uses_the_trained_gesture() -> None:
    [sighting] = detect([PALM], FakeClassifier("ok_sign", 0.6))
    assert (sighting.gesture, sighting.confidence) == ("ok_sign", 0.6)


def test_keeps_the_hand() -> None:
    [sighting] = detect([PALM], FakeClassifier("ok_sign", 0.6))
    assert sighting.hand == HAND


def test_classifies_every_hand() -> None:
    classifier = FakeClassifier("ok_sign", 0.9)
    assert len(detect([PALM, PALM], classifier)) == 2


def test_no_hands_needs_no_classifier() -> None:
    classifier = FakeClassifier("ok_sign", 0.9)
    detect([], classifier)
    assert classifier.rows_seen == 0


def test_both_takes_a_confident_trained_gesture() -> None:
    [sighting] = detect([PALM], FakeClassifier("ok_sign", CUSTOM_WINS_AT), trained_when_confident)
    assert sighting.gesture == "ok_sign"


def test_both_keeps_the_built_in_gesture_when_unsure() -> None:
    [sighting] = detect([PALM], FakeClassifier("ok_sign", CUSTOM_WINS_AT - 0.1), trained_when_confident)
    assert sighting == PALM


def test_both_keeps_the_built_in_gesture_when_trained_sees_none() -> None:
    [sighting] = detect([PALM], FakeClassifier("none", 0.99), trained_when_confident)
    assert sighting == PALM
