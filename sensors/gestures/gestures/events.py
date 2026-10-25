"""Stable gesture events, as the stabilizer emits them and the protocol prints them."""

from __future__ import annotations

from dataclasses import dataclass

NO_GESTURE = "none"


@dataclass(frozen=True)
class GestureStart:
    name: str
    hand: str
    confidence: float
    ts: int

    def message(self) -> dict[str, object]:
        return {
            "type": "gesture",
            "phase": "start",
            "name": self.name,
            "hand": self.hand,
            "confidence": round(self.confidence, 3),
            "ts": self.ts,
        }


@dataclass(frozen=True)
class GestureEnd:
    name: str
    hand: str
    held_ms: int
    ts: int

    def message(self) -> dict[str, object]:
        return {
            "type": "gesture",
            "phase": "end",
            "name": self.name,
            "hand": self.hand,
            "heldMs": self.held_ms,
            "ts": self.ts,
        }


GestureEvent = GestureStart | GestureEnd
