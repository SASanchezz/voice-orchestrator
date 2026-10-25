"""`python -m gestures collect --label ok_sign`: records your hand's features while you show a gesture.

A window shows the camera. After a short countdown, every hand in every frame becomes one feature row, until the
time is up (or q / Esc). The rows are added to data/<label>.csv, so several sessions add up.
"""

from __future__ import annotations

import sys
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from .camera import Camera, CameraConfig
from .drawing import draw_caption
from .landmarks import features
from .models import gesture_recognizer_model
from .pipeline import now_ms
from .preview import WINDOW, selfie_view, should_quit
from .recognizer_canned import CannedRecognizer, RecognizerConfig, Sighting
from .recognizers import Recognizer
from .samples import DATA_DIR, append_samples

COUNTDOWN_MS = 3000


@dataclass(frozen=True)
class CollectSettings:
    camera: CameraConfig
    recognizer: RecognizerConfig
    label: str
    seconds: int


def run_collect(settings: CollectSettings, data_dir: Path = DATA_DIR) -> None:
    model = gesture_recognizer_model()
    with Camera(settings.camera) as cam, CannedRecognizer(model, settings.recognizer) as recognizer:
        recording = Recording(settings.label, now_ms(), settings.seconds)
        _record(cam.frames(), recognizer, recording)
    cv2.destroyAllWindows()
    path = append_samples(settings.label, recording.rows, data_dir)
    print(f"Added {len(recording.rows)} samples to {path}", file=sys.stderr)


def _record(frames: Iterable[np.ndarray], recognizer: Recognizer, recording: Recording) -> None:
    """Feeds frames into the recording, showing each one, until it's done or the window is closed."""
    for frame in frames:
        ts = now_ms()
        sightings = recognizer.detect(frame, ts)
        recording.add(ts, sightings)
        _show(frame, sightings, recording.caption(ts))
        if recording.is_done(ts) or should_quit():
            return


def _show(frame: np.ndarray, sightings: list[Sighting], caption: str) -> None:
    view = selfie_view(frame, sightings)
    draw_caption(view, caption)
    cv2.imshow(WINDOW, view)


class Recording:
    """Collects feature rows between the end of the countdown and the end of the recording time."""

    def __init__(self, label: str, started_ms: int, seconds: int) -> None:
        self._label = label
        self._recording_from = started_ms + COUNTDOWN_MS
        self._recording_until = self._recording_from + seconds * 1000
        self.rows: list[np.ndarray] = []

    def add(self, ts: int, sightings: list[Sighting]) -> None:
        if self._recording_from <= ts < self._recording_until:
            self.rows += [features(sighting.hand) for sighting in sightings]

    def is_done(self, ts: int) -> bool:
        return ts >= self._recording_until

    def caption(self, ts: int) -> str:
        if ts < self._recording_from:
            return f"show {self._label} in {_seconds_until(ts, self._recording_from)} ..."
        left = _seconds_until(ts, self._recording_until)
        return f"recording {self._label}: {left} s left, {len(self.rows)} samples (move it around)"


def _seconds_until(ts: int, until: int) -> int:
    return -(-(until - ts) // 1000)  # rounded up, so the countdown never shows 0 while it's still running
