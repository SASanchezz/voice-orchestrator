"""The sensor's stdout protocol: one JSON object per line, flushed at once. Logs go to stderr only."""

from __future__ import annotations

import json
from collections.abc import Sequence
from typing import TextIO

from .events import GestureEvent


class EventWriter:
    def __init__(self, stream: TextIO) -> None:
        self._stream = stream

    def ready(self, recognizer: str) -> None:
        self._write({"type": "ready", "recognizer": recognizer})

    def gestures(self, events: Sequence[GestureEvent]) -> None:
        for event in events:
            self._write(event.message())

    def error(self, message: str) -> None:
        self._write({"type": "error", "message": message})

    def snapshot_taken(self, request_id: str, path: str) -> None:
        self._write({"type": "snapshot", "id": request_id, "path": path, "ok": True})

    def snapshot_failed(self, request_id: str, message: str) -> None:
        self._write({"type": "snapshot", "id": request_id, "ok": False, "message": message})

    def _write(self, message: dict[str, object]) -> None:
        self._stream.write(json.dumps(message, separators=(",", ":")) + "\n")
        self._stream.flush()
