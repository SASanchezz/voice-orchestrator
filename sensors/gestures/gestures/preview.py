"""`python -m gestures preview`: a window with the camera, hand skeletons, gestures and FPS.

Events are printed on stdout as in `run`, so thresholds can be tuned while watching.
"""

from __future__ import annotations

import cv2
import numpy as np

from .camera import Camera
from .drawing import draw_sightings, draw_status
from .fps import FpsMeter
from .pipeline import GesturePipeline, SensorSettings, open_pipeline
from .protocol import EventWriter
from .recognizer_canned import Sighting

WINDOW = "gestures preview"
QUIT_KEYS = (ord("q"), 27)  # q, Esc


def run_preview(settings: SensorSettings, out: EventWriter) -> None:
    with open_pipeline(settings, out) as (cam, pipeline):
        _loop(cam, pipeline)
    cv2.destroyAllWindows()


def _loop(cam: Camera, pipeline: GesturePipeline) -> None:
    fps = FpsMeter()
    for frame in cam.frames():
        view = _selfie_view(frame, pipeline.process(frame))
        draw_status(view, fps.tick(), pipeline.holds())
        cv2.imshow(WINDOW, view)
        if _should_quit():
            return


def _selfie_view(frame: np.ndarray, sightings: list[Sighting]) -> np.ndarray:
    """Mirrored, because that's how people expect to see themselves. Detection ran on the raw frame."""
    view = cv2.flip(frame, 1)
    draw_sightings(view, [sighting.mirrored() for sighting in sightings])
    return view


def _should_quit() -> bool:
    key = cv2.waitKey(1) & 0xFF
    closed = cv2.getWindowProperty(WINDOW, cv2.WND_PROP_VISIBLE) < 1
    return key in QUIT_KEYS or closed
