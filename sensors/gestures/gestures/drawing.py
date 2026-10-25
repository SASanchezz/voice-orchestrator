"""Draws hands with their raw gesture label, and a status line with the stable holds, onto a BGR frame (in place)."""

from __future__ import annotations

from collections.abc import Mapping, Sequence

import cv2
import numpy as np
from mediapipe.tasks.python.vision import HandLandmarksConnections

from .landmarks import Hand
from .recognizer_canned import Sighting

BONES = tuple((c.start, c.end) for c in HandLandmarksConnections.HAND_CONNECTIONS)
FINGERTIPS = (4, 8, 12, 16, 20)

# BGR
COLORS = {"left": (255, 160, 60), "right": (60, 200, 255)}
TEXT_COLOR = (255, 255, 255)
BOX_COLOR = (0, 0, 0)

FONT = cv2.FONT_HERSHEY_SIMPLEX
FONT_SCALE = 0.7
FONT_THICKNESS = 1
TEXT_PADDING = 4


def draw_sightings(frame: np.ndarray, sightings: Sequence[Sighting]) -> None:
    for sighting in sightings:
        _draw_hand(frame, sighting.hand)
        _draw_label(frame, sighting)


def draw_status(frame: np.ndarray, fps: float, holds: Mapping[str, str]) -> None:
    held = ", ".join(f"{side} {gesture}" for side, gesture in holds.items()) or "-"
    _text(frame, f"FPS {fps:4.1f}   holding: {held}", (16, 32))
    _text(frame, "q / Esc: quit", (16, frame.shape[0] - 16))


def _draw_hand(frame: np.ndarray, hand: Hand) -> None:
    color = COLORS.get(hand.side, TEXT_COLOR)
    pixels = _to_pixels(frame, hand)
    for start, end in BONES:
        cv2.line(frame, pixels[start], pixels[end], color, 2, cv2.LINE_AA)
    for index, point in enumerate(pixels):
        radius = 6 if index in FINGERTIPS else 4
        cv2.circle(frame, point, radius, color, -1, cv2.LINE_AA)


def _draw_label(frame: np.ndarray, sighting: Sighting) -> None:
    wrist_x, wrist_y = _to_pixels(frame, sighting.hand)[0]
    label = f"{sighting.side}: {sighting.gesture} {sighting.confidence:.2f}"
    _text(frame, label, (wrist_x + 10, wrist_y + 24))


def _to_pixels(frame: np.ndarray, hand: Hand) -> list[tuple[int, int]]:
    height, width = frame.shape[:2]
    return [(int(x * width), int(y * height)) for x, y, _ in hand.points]


def _text(frame: np.ndarray, text: str, origin: tuple[int, int]) -> None:
    # A box instead of a thick-text shadow: OpenCV 5 widens thick text, so a shadow drifts off the letters.
    (width, height), baseline = cv2.getTextSize(text, FONT, FONT_SCALE, FONT_THICKNESS)
    x, y = origin
    top_left = (x - TEXT_PADDING, y - height - TEXT_PADDING)
    bottom_right = (x + width + TEXT_PADDING, y + baseline + TEXT_PADDING)
    cv2.rectangle(frame, top_left, bottom_right, BOX_COLOR, cv2.FILLED)
    cv2.putText(frame, text, origin, FONT, FONT_SCALE, TEXT_COLOR, FONT_THICKNESS, cv2.LINE_AA)
