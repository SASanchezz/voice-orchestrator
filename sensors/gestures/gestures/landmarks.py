"""A hand as MediaPipe sees it: handedness plus 21 landmarks, as plain values, and its feature vector."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, replace
from typing import Any

import numpy as np

LANDMARK_COUNT = 21
FEATURE_COUNT = LANDMARK_COUNT * 3
# Bump when `features` changes: classifiers trained on another version must be retrained.
FEATURE_VERSION = 1

WRIST = 0
MIDDLE_FINGER_BASE = 9
# Keeps a degenerate hand (all points in one place) from dividing by zero.
MIN_PALM_SIZE = 1e-6

Point = tuple[float, float, float]


@dataclass(frozen=True)
class Hand:
    """One detected hand. Points are normalized: x, y in 0..1 of the image; z relative to the wrist."""

    side: str  # "left" | "right"
    score: float
    points: tuple[Point, ...]

    def mirrored(self) -> Hand:
        """The same hand drawn on a horizontally flipped image. It's still the same physical hand."""
        return replace(self, points=tuple((1 - x, y, z) for x, y, z in self.points))


def hand_from(handedness: Sequence[Any], landmarks: Sequence[Any]) -> Hand:
    """Builds a Hand from one hand's MediaPipe handedness categories and landmarks."""
    best = handedness[0]
    points = tuple((float(p.x), float(p.y), float(p.z)) for p in landmarks)
    return Hand(side=str(best.category_name).lower(), score=float(best.score), points=points)


def features(hand: Hand) -> np.ndarray:
    """The hand's shape as FEATURE_COUNT numbers, the same wherever the hand is, however big it looks,
    and for either hand: points relative to the wrist, scaled by the palm size, a left hand mirrored to a right one."""
    relative = np.array(hand.points, dtype=np.float64) - hand.points[WRIST]
    if hand.side == "left":
        relative[:, 0] *= -1
    palm_size = max(float(np.linalg.norm(relative[MIDDLE_FINGER_BASE])), MIN_PALM_SIZE)
    return (relative / palm_size).ravel()
