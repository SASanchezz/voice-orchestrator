"""The listener's stdout protocol: one JSON object per line, flushed at once. Logs go to stderr only."""

from __future__ import annotations

import json
from typing import TextIO

from .listener import Event


class EventWriter:
    def __init__(self, stream: TextIO) -> None:
        self._stream = stream

    def ready(self, model: str) -> None:
        self._write({"type": "ready", "model": model})

    def event(self, event: Event) -> None:
        self._write(event.message())

    def samples(self, wake: int, other: int, trained: bool) -> None:
        """How many recordings there are of each kind, and whether a trained model exists."""
        self._write({"type": "samples", "wake": wake, "other": other, "trained": trained})

    def trained(self, report: dict[str, object]) -> None:
        self._write({"type": "trained", **report})

    def tried(self, score: float, threshold: float) -> None:
        self._write({"type": "tried", "score": round(score, 3), "threshold": threshold})

    def error(self, message: str) -> None:
        self._write({"type": "error", "message": message})

    def _write(self, message: dict[str, object]) -> None:
        self._stream.write(json.dumps(message, separators=(",", ":")) + "\n")
        self._stream.flush()
