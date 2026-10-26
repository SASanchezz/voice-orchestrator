"""Camera snapshots on request: stdin `snapshot` commands are answered with a JPEG of the latest frame."""

from __future__ import annotations

import json
import os
import queue
import sys
import threading
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from typing import TextIO

import cv2
import numpy as np

from .protocol import EventWriter

# Longest edge Claude's vision uses without downscaling; anything bigger only costs tokens.
MAX_EDGE_PX = 1568
JPEG_QUALITY = 85


@dataclass(frozen=True)
class SnapshotRequest:
    id: str
    path: str


def read_request(line: str) -> SnapshotRequest:
    """One stdin line, `{"cmd":"snapshot","id":"abc","path":"/abs/state/camera/abc.jpg"}`; ValueError if it isn't."""
    command = json.loads(line)
    if not isinstance(command, dict) or command.get("cmd") != "snapshot":
        raise ValueError("not a snapshot command")
    request_id, path = command.get("id"), command.get("path")
    if not isinstance(request_id, str) or not isinstance(path, str) or not os.path.isabs(path):
        raise ValueError("a snapshot needs a string id and an absolute path")
    return SnapshotRequest(request_id, path)


class SnapshotRequests:
    """Reads requests from `commands` on a background thread; the frame loop takes them between frames."""

    def __init__(self) -> None:
        self._waiting: queue.SimpleQueue[SnapshotRequest] = queue.SimpleQueue()

    def listen(self, commands: TextIO) -> None:
        threading.Thread(target=self.read_all, args=(commands,), daemon=True).start()

    def read_all(self, commands: Iterable[str]) -> None:
        for line in commands:
            self._read(line)

    def take_all(self) -> list[SnapshotRequest]:
        taken: list[SnapshotRequest] = []
        while not self._waiting.empty():
            taken.append(self._waiting.get())
        return taken

    def _read(self, line: str) -> None:
        try:
            self._waiting.put(read_request(line))
        except ValueError as e:  # json.JSONDecodeError is a ValueError too
            print(f"skipped a command it couldn't read ({e}): {line.strip()}", file=sys.stderr)


class SnapshotTaker:
    """Answers each waiting request with the frame the camera delivers next, so it is never older than a frame."""

    def __init__(self, requests: SnapshotRequests, out: EventWriter) -> None:
        self._requests = requests
        self._out = out

    def serving(self, frames: Iterable[np.ndarray]) -> Iterator[np.ndarray]:
        for frame in frames:
            for request in self._requests.take_all():
                self._take(frame, request)
            yield frame

    def _take(self, frame: np.ndarray, request: SnapshotRequest) -> None:
        picture = fit_longest_edge(frame, MAX_EDGE_PX)
        if cv2.imwrite(request.path, picture, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]):
            self._out.snapshot_taken(request.id, request.path)
        else:
            self._out.snapshot_failed(request.id, f"couldn't write {request.path}")


def fit_longest_edge(frame: np.ndarray, max_edge: int) -> np.ndarray:
    height, width = frame.shape[:2]
    scale = max_edge / max(height, width)
    if scale >= 1:
        return frame
    size = (round(width * scale), round(height * scale))
    return cv2.resize(frame, size, interpolation=cv2.INTER_AREA)
