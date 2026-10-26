"""Raw sightings -> stable events: poses from the stabilizer, swipes from the swipe detector."""

from __future__ import annotations

from collections.abc import Sequence

from .events import GestureEvent
from .recognizer_canned import Sighting
from .stabilizer import Stabilizer
from .swipes import SwipeDetector


class GestureTracker:
    """A moving hand can't start a pose: a swipe is made with an open hand, and would start `open_palm` on the way."""

    def __init__(self, stabilizer: Stabilizer, swipes: SwipeDetector) -> None:
        self._stabilizer = stabilizer
        self._swipes = swipes

    def update(self, ts: int, sightings: Sequence[Sighting]) -> list[GestureEvent]:
        taps = self._swipes.update(ts, sightings)
        for side, until in self._swipes.busy_until(ts).items():
            self._stabilizer.hold_off(side, until)
        return [*self._stabilizer.update(ts, sightings), *taps]

    def holds(self) -> dict[str, str]:
        return self._stabilizer.holds()

    def close(self, ts: int) -> list[GestureEvent]:
        return self._stabilizer.close(ts)
