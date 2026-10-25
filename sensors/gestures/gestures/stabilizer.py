"""Turns jittery per-frame gesture labels into clean start/end events, separately for each hand.

A gesture must be seen for `min_hold_ms` at `min_confidence` or more before it starts. Once started,
any frame with the same label keeps it alive (whatever its confidence), and it ends after `release_ms`
of something else or no hand. After an end, that hand can't start the same gesture for `cooldown_ms`.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from .events import NO_GESTURE, GestureEnd, GestureEvent, GestureStart

SIDES = ("left", "right")


@dataclass(frozen=True)
class StabilizerConfig:
    min_hold_ms: int = 250
    min_confidence: float = 0.7
    release_ms: int = 200
    cooldown_ms: int = 500


class Reading(Protocol):
    """One hand's raw label in one frame."""

    @property
    def side(self) -> str: ...
    @property
    def gesture(self) -> str: ...
    @property
    def confidence(self) -> float: ...


class Stabilizer:
    """Feed it every frame, including frames without hands: that's how it notices a hand leaving."""

    def __init__(self, cfg: StabilizerConfig) -> None:
        self._hands = {side: HandStabilizer(side, cfg) for side in SIDES}

    def update(self, ts: int, readings: Sequence[Reading]) -> list[GestureEvent]:
        events: list[GestureEvent] = []
        for side, hand in self._hands.items():
            gesture, confidence = _strongest(readings, side)
            events += hand.update(ts, gesture, confidence)
        return events

    def holds(self) -> dict[str, str]:
        """Gestures currently held, by hand."""
        return {side: hand.held for side, hand in self._hands.items() if hand.held != NO_GESTURE}

    def close(self, ts: int) -> list[GestureEvent]:
        """Ends every open hold, so a listener is never left holding one when the sensor stops."""
        return [event for hand in self._hands.values() for event in hand.close(ts)]


def _strongest(readings: Sequence[Reading], side: str) -> tuple[str, float]:
    mine = [reading for reading in readings if reading.side == side]
    if not mine:
        return NO_GESTURE, 0.0
    best = max(mine, key=_confidence)
    return best.gesture, best.confidence


def _confidence(reading: Reading) -> float:
    return reading.confidence


@dataclass
class _Candidate:
    name: str
    since: int


@dataclass
class _Hold:
    name: str
    started: int
    last_seen: int


class HandStabilizer:
    def __init__(self, side: str, cfg: StabilizerConfig) -> None:
        self._side = side
        self._cfg = cfg
        self._candidate = _Candidate(NO_GESTURE, 0)
        self._hold: _Hold | None = None
        self._cooldown_until: dict[str, int] = {}

    @property
    def held(self) -> str:
        return self._hold.name if self._hold else NO_GESTURE

    def update(self, ts: int, gesture: str, confidence: float) -> list[GestureEvent]:
        hold = self._hold
        if hold is None:
            return self._try_start(ts, gesture, confidence)
        if gesture == hold.name:
            hold.last_seen = ts
            return []
        if ts - hold.last_seen < self._cfg.release_ms:
            return []
        return [self._end(hold, ts), *self._try_start(ts, gesture, confidence)]

    def close(self, ts: int) -> list[GestureEvent]:
        if self._hold is None:
            return []
        return [self._end(self._hold, ts)]

    def _try_start(self, ts: int, gesture: str, confidence: float) -> list[GestureEvent]:
        if not self._is_confident(gesture, confidence):
            self._candidate = _Candidate(NO_GESTURE, ts)
            return []
        if gesture != self._candidate.name:
            self._candidate = _Candidate(gesture, ts)
        held_long_enough = ts - self._candidate.since >= self._cfg.min_hold_ms
        if not held_long_enough or self._is_cooling_down(gesture, ts):
            return []
        self._hold = _Hold(gesture, started=ts, last_seen=ts)
        return [GestureStart(gesture, self._side, confidence, ts)]

    def _end(self, hold: _Hold, ts: int) -> GestureEnd:
        self._hold = None
        self._candidate = _Candidate(NO_GESTURE, ts)
        self._cooldown_until[hold.name] = ts + self._cfg.cooldown_ms
        return GestureEnd(hold.name, self._side, hold.last_seen - hold.started, ts)

    def _is_confident(self, gesture: str, confidence: float) -> bool:
        return gesture != NO_GESTURE and confidence >= self._cfg.min_confidence

    def _is_cooling_down(self, gesture: str, ts: int) -> bool:
        return ts < self._cooldown_until.get(gesture, 0)
