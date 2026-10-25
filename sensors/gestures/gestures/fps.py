"""Frames per second, smoothed so the number on screen doesn't flicker."""

from __future__ import annotations

import time
from collections.abc import Callable

SMOOTHING = 0.1  # weight of the newest frame interval


class FpsMeter:
    def __init__(self, clock: Callable[[], float] = time.perf_counter) -> None:
        self._clock = clock
        self._last: float | None = None
        self._interval: float | None = None

    def tick(self) -> float:
        """Call once per frame; returns the current smoothed FPS (0 until two frames have been seen)."""
        now = self._clock()
        if self._last is not None:
            interval = now - self._last
            self._interval = interval if self._interval is None else _blend(self._interval, interval)
        self._last = now
        return self.fps

    @property
    def fps(self) -> float:
        if not self._interval:
            return 0.0
        return 1.0 / self._interval


def _blend(average: float, newest: float) -> float:
    return average * (1 - SMOOTHING) + newest * SMOOTHING
