"""Swipes: an open hand moving fast sideways, one `tap` event per swipe, separately for each hand.

Named from the user's side: `swipe_right` moves the hand to the user's right (to the right in the mirrored preview).
The camera faces the user, so in the raw frame that is towards smaller x.
"""

from __future__ import annotations

import math
from collections import deque
from collections.abc import Sequence
from dataclasses import dataclass

from .events import GestureTap
from .landmarks import WRIST, is_open_hand
from .recognizer_canned import Sighting
from .stabilizer import SIDES

SWIPE_LEFT = "swipe_left"
SWIPE_RIGHT = "swipe_right"
# The sideways travel must be at least this many times the vertical one.
MIN_STRAIGHTNESS = 2.0
# Before any hold-off: a hand that never moved is free to start a pose.
NEVER = -1


@dataclass(frozen=True)
class SwipeConfig:
    window_ms: int = 500
    min_travel: float = 0.25  # image widths, within the window
    min_open_share: float = 0.6  # of the window's frames showing an open hand
    cooldown_ms: int = 800  # long enough to ignore the hand swinging back
    still_speed: float = 0.3  # image sizes per second; faster is moving, not holding a pose
    motion_ms: int = 150  # how far back the speed is measured


class SwipeDetector:
    """Feed it every frame. It also says which hands are busy moving, so they don't start a pose meanwhile."""

    def __init__(self, cfg: SwipeConfig) -> None:
        self._hands = {side: HandTrail(side, cfg) for side in SIDES}

    def update(self, ts: int, sightings: Sequence[Sighting]) -> list[GestureTap]:
        taps: list[GestureTap] = []
        for side, trail in self._hands.items():
            taps += trail.update(ts, [sighting for sighting in sightings if sighting.side == side])
        return taps

    def busy_until(self, ts: int) -> dict[str, int]:
        """Per hand, until when (inclusive) it shouldn't start a pose: while it moves, and after a swipe."""
        return {side: trail.busy_until(ts) for side, trail in self._hands.items()}


@dataclass(frozen=True)
class _Spot:
    ts: int
    x: float
    y: float
    is_open: bool


class HandTrail:
    """One hand's wrist over the last `window_ms`."""

    def __init__(self, side: str, cfg: SwipeConfig) -> None:
        self._side = side
        self._cfg = cfg
        self._spots: deque[_Spot] = deque()
        self._cooldown_until = NEVER

    def update(self, ts: int, sightings: Sequence[Sighting]) -> list[GestureTap]:
        if ts < self._cooldown_until:
            return []
        self._remember(ts, sightings)
        self._forget_before(ts - self._cfg.window_ms)
        if not self._is_swipe():
            return []
        return [self._swipe(ts)]

    def busy_until(self, ts: int) -> int:
        moving_until = ts if self._is_moving() else NEVER
        return max(self._cooldown_until, moving_until)

    def _remember(self, ts: int, sightings: Sequence[Sighting]) -> None:
        """Two hands can both look like this one; the more certain of them is it."""
        if not sightings:
            return
        hand = max(sightings, key=_hand_score).hand
        x, y, _ = hand.points[WRIST]
        self._spots.append(_Spot(ts, x, y, is_open_hand(hand)))

    def _forget_before(self, ts: int) -> None:
        while self._spots and self._spots[0].ts < ts:
            self._spots.popleft()

    def _is_swipe(self) -> bool:
        if len(self._spots) < 2:
            return False
        dx, dy = _travel(self._spots[0], self._spots[-1])
        is_far = abs(dx) >= self._cfg.min_travel
        is_straight = abs(dx) >= MIN_STRAIGHTNESS * abs(dy)
        return is_far and is_straight and self._open_share() >= self._cfg.min_open_share

    def _swipe(self, ts: int) -> GestureTap:
        dx, _ = _travel(self._spots[0], self._spots[-1])
        tap = GestureTap(SWIPE_RIGHT if dx < 0 else SWIPE_LEFT, self._side, self._open_share(), ts)
        self._spots.clear()
        self._cooldown_until = ts + self._cfg.cooldown_ms
        return tap

    def _open_share(self) -> float:
        return sum(spot.is_open for spot in self._spots) / len(self._spots)

    def _is_moving(self) -> bool:
        if not self._spots:
            return False
        newest = self._spots[-1]
        recent = [spot for spot in self._spots if spot.ts >= newest.ts - self._cfg.motion_ms]
        elapsed_s = (newest.ts - recent[0].ts) / 1000
        if elapsed_s <= 0:
            return False
        return math.hypot(*_travel(recent[0], newest)) / elapsed_s > self._cfg.still_speed


def _hand_score(sighting: Sighting) -> float:
    return sighting.hand.score


def _travel(start: _Spot, end: _Spot) -> tuple[float, float]:
    return end.x - start.x, end.y - start.y
