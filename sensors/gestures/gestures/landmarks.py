"""A hand as MediaPipe sees it: handedness plus 21 landmarks, as plain values."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, replace
from typing import Any

LANDMARK_COUNT = 21

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
