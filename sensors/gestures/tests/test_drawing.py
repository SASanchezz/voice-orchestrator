import numpy as np

from gestures.drawing import BONES, draw_sightings, draw_status
from gestures.landmarks import LANDMARK_COUNT, Hand
from gestures.recognizer_canned import Sighting


def a_sighting() -> Sighting:
    points = tuple((0.3 + i * 0.01, 0.3 + i * 0.015, 0.0) for i in range(LANDMARK_COUNT))
    return Sighting(Hand(side="right", score=0.97, points=points), "open_palm", 0.9)


def a_frame() -> np.ndarray:
    return np.zeros((480, 640, 3), dtype=np.uint8)


def test_bones_cover_all_landmarks() -> None:
    assert len(BONES) == 21
    assert {i for bone in BONES for i in bone} == set(range(LANDMARK_COUNT))


def test_draws_on_the_frame() -> None:
    frame = a_frame()
    draw_sightings(frame, [a_sighting()])
    assert frame.any()


def test_status_without_holds() -> None:
    frame = a_frame()
    draw_status(frame, 29.7, {})
    assert frame.any()
