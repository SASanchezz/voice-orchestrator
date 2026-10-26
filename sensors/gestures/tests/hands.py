"""Synthetic hands for the swipe and tracker tests."""

from gestures.landmarks import FINGERS, LANDMARK_COUNT, Hand
from gestures.recognizer_canned import Sighting

# Each landmark a little higher up than the one before: every fingertip lies beyond its middle joint.
POINT_STEP = 0.01
CURLED_TIP_OFFSET = 0.01


def open_hand(x: float, y: float = 0.5, side: str = "right") -> Hand:
    points = tuple((x, y - POINT_STEP * index, 0.0) for index in range(LANDMARK_COUNT))
    return Hand(side, 0.95, points)


def fist(x: float, y: float = 0.5, side: str = "right") -> Hand:
    tips = {tip for _, tip in FINGERS}
    points = tuple((x, y - _height(index, tips), 0.0) for index in range(LANDMARK_COUNT))
    return Hand(side, 0.95, points)


def _height(index: int, tips: set[int]) -> float:
    return CURLED_TIP_OFFSET if index in tips else POINT_STEP * index


def seen(hand: Hand, gesture: str = "open_palm") -> Sighting:
    return Sighting(hand, gesture, 0.9)
