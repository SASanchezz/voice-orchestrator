"""MediaPipe GestureRecognizer: a BGR frame in, each hand's skeleton and built-in gesture out.

Give it raw, unmirrored frames: on those, MediaPipe's "Right" is the user's right hand.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, replace
from pathlib import Path
from types import TracebackType
from typing import Any

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import GestureRecognizer, GestureRecognizerOptions, RunningMode

from .events import NO_GESTURE
from .landmarks import Hand, hand_from

RECOGNIZER_NAME = "canned"

CANNED_NAMES = {
    "None": NO_GESTURE,
    "Open_Palm": "open_palm",
    "Closed_Fist": "closed_fist",
    "Pointing_Up": "pointing_up",
    "Thumb_Up": "thumb_up",
    "Thumb_Down": "thumb_down",
    "Victory": "victory",
    "ILoveYou": "i_love_you",
}


@dataclass(frozen=True)
class Sighting:
    """One hand in one frame with its raw (unstabilized) gesture label."""

    hand: Hand
    gesture: str
    confidence: float

    @property
    def side(self) -> str:
        return self.hand.side

    def mirrored(self) -> Sighting:
        return replace(self, hand=self.hand.mirrored())


@dataclass(frozen=True)
class RecognizerConfig:
    max_hands: int = 2
    min_detection: float = 0.5
    min_presence: float = 0.5
    min_tracking: float = 0.5


class CannedRecognizer:
    """Context manager around GestureRecognizer in VIDEO mode (synchronous, tracks between frames)."""

    def __init__(self, model_path: Path, cfg: RecognizerConfig) -> None:
        self._recognizer = GestureRecognizer.create_from_options(_options(model_path, cfg))
        self._last_ts = -1

    def __enter__(self) -> CannedRecognizer:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        self._recognizer.close()

    def detect(self, frame_bgr: np.ndarray, timestamp_ms: int) -> list[Sighting]:
        # VIDEO mode needs strictly increasing timestamps.
        self._last_ts = max(timestamp_ms, self._last_ts + 1)
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        return sightings_from_result(self._recognizer.recognize_for_video(image, self._last_ts))


def sightings_from_result(result: Any) -> list[Sighting]:
    """Turns a GestureRecognizerResult into plain Sighting values (pure, so it's testable without a model)."""
    hands = zip(result.gestures, result.handedness, result.hand_landmarks, strict=True)
    return [_sighting(gestures, handedness, landmarks) for gestures, handedness, landmarks in hands]


def _sighting(gestures: Sequence[Any], handedness: Sequence[Any], landmarks: Sequence[Any]) -> Sighting:
    name, confidence = _top_gesture(gestures)
    return Sighting(hand_from(handedness, landmarks), name, confidence)


def _top_gesture(categories: Sequence[Any]) -> tuple[str, float]:
    if not categories:
        return NO_GESTURE, 0.0
    best = categories[0]
    label = str(best.category_name)
    return CANNED_NAMES.get(label, label.lower()), float(best.score)


def _options(model_path: Path, cfg: RecognizerConfig) -> GestureRecognizerOptions:
    return GestureRecognizerOptions(
        base_options=BaseOptions(model_asset_path=str(model_path)),
        running_mode=RunningMode.VIDEO,
        num_hands=cfg.max_hands,
        min_hand_detection_confidence=cfg.min_detection,
        min_hand_presence_confidence=cfg.min_presence,
        min_tracking_confidence=cfg.min_tracking,
    )
