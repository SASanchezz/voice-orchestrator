from types import SimpleNamespace

import numpy as np
import pytest

from gestures.landmarks import LANDMARK_COUNT
from gestures.models import GESTURE_RECOGNIZER, MODELS_DIR
from gestures.recognizer_canned import CannedRecognizer, RecognizerConfig, sightings_from_result


def category(name: str, score: float) -> list[SimpleNamespace]:
    return [SimpleNamespace(category_name=name, score=score)]


def fake_result(*hands: tuple[str, str, float]) -> SimpleNamespace:
    """Each hand is (side, MediaPipe gesture label, gesture score); an empty label means no gesture category."""
    points = [SimpleNamespace(x=0.5, y=0.5, z=0.0)] * LANDMARK_COUNT
    return SimpleNamespace(
        gestures=[category(label, score) if label else [] for _, label, score in hands],
        handedness=[category(side, 0.95) for side, _, _ in hands],
        hand_landmarks=[points for _ in hands],
    )


def test_no_hands() -> None:
    assert sightings_from_result(fake_result()) == []


def test_built_in_labels_become_snake_case() -> None:
    [sighting] = sightings_from_result(fake_result(("Right", "ILoveYou", 0.8)))
    assert sighting.gesture == "i_love_you"


def test_keeps_gesture_confidence_and_side() -> None:
    [sighting] = sightings_from_result(fake_result(("Left", "Open_Palm", 0.91)))
    assert (sighting.side, sighting.gesture, sighting.confidence) == ("left", "open_palm", 0.91)


def test_missing_gesture_category_reads_as_none() -> None:
    [sighting] = sightings_from_result(fake_result(("Right", "", 0.0)))
    assert (sighting.gesture, sighting.confidence) == ("none", 0.0)


def test_mirrored_sighting_keeps_side_and_gesture() -> None:
    [sighting] = sightings_from_result(fake_result(("Right", "Victory", 0.9)))
    mirrored = sighting.mirrored()
    assert (mirrored.side, mirrored.gesture) == ("right", "victory")


MODEL = MODELS_DIR / GESTURE_RECOGNIZER[0]


@pytest.mark.skipif(not MODEL.exists(), reason="run `python -m gestures preview` once to download the model")
def test_real_model_finds_no_hand_in_a_blank_frame() -> None:
    blank = np.zeros((480, 640, 3), dtype=np.uint8)
    with CannedRecognizer(MODEL, RecognizerConfig()) as recognizer:
        assert recognizer.detect(blank, 0) == []
        assert recognizer.detect(blank, 0) == []  # same timestamp twice is fine
