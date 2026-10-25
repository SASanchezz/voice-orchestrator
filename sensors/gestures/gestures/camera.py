"""Webcam frames via OpenCV, as the camera sees them (not mirrored).

Detection needs the raw frame: on it, MediaPipe's "Right" is the user's right hand.
Mirroring is only for display (see preview.py).
"""

from __future__ import annotations

import sys
from collections.abc import Iterator
from dataclasses import dataclass
from types import TracebackType

import cv2
import numpy as np

# The first reads can fail while macOS shows the camera permission prompt.
MAX_FAILED_READS = 60


class CameraError(RuntimeError):
    """The camera can't be opened or stopped delivering frames."""


@dataclass(frozen=True)
class CameraConfig:
    index: int = 0
    width: int = 1280
    height: int = 720


class Camera:
    """Context manager: `with Camera(cfg) as cam: for frame in cam.frames(): ...` (BGR frames)."""

    def __init__(self, cfg: CameraConfig) -> None:
        self._cfg = cfg
        self._cap: cv2.VideoCapture | None = None

    def __enter__(self) -> Camera:
        self._cap = _open(self._cfg)
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    def frames(self) -> Iterator[np.ndarray]:
        if self._cap is None:
            raise CameraError("Camera is not open; use it inside `with`.")
        failed = 0
        while True:
            ok, frame = self._cap.read()
            if not ok:
                failed += 1
                if failed > MAX_FAILED_READS:
                    raise CameraError(_no_frames_message(self._cfg.index))
                continue
            failed = 0
            yield frame


def _open(cfg: CameraConfig) -> cv2.VideoCapture:
    backend = cv2.CAP_AVFOUNDATION if sys.platform == "darwin" else cv2.CAP_ANY
    cap = cv2.VideoCapture(cfg.index, backend)
    if not cap.isOpened():
        cap.release()
        raise CameraError(_no_frames_message(cfg.index))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, cfg.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, cfg.height)
    return cap


def _no_frames_message(index: int) -> str:
    return (
        f"Camera {index} gives no frames. Check that no other app is using it, try --camera 1, "
        "and allow Camera for your terminal app in System Settings > Privacy & Security > Camera "
        "(then fully quit and reopen the terminal)."
    )
