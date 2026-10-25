"""`python -m gestures run`: no window, just gesture events as JSON lines on stdout."""

from __future__ import annotations

import signal
import threading
from collections.abc import Iterable

import numpy as np

from .camera import CameraError
from .pipeline import GesturePipeline, SensorSettings, open_pipeline
from .protocol import EventWriter
from .recognizer_canned import RECOGNIZER_NAME

STOP_SIGNALS = (signal.SIGINT, signal.SIGTERM)


def run_sensor(settings: SensorSettings, out: EventWriter) -> None:
    try:
        _run(settings, out)
    except (CameraError, RuntimeError) as e:
        out.error(str(e))
        raise


def _run(settings: SensorSettings, out: EventWriter) -> None:
    stop = _stop_on_signals()
    with open_pipeline(settings, out) as (cam, pipeline):
        out.ready(RECOGNIZER_NAME)
        process_until(cam.frames(), pipeline, stop)


def _stop_on_signals() -> threading.Event:
    """Ctrl+C and the orchestrator's SIGTERM often arrive together. Raised as KeyboardInterrupt, the second one
    would break into MediaPipe's close() halfway, and its finalizer then closes again and crashes. A flag checked
    between frames lets cleanup run once and whole; held gestures still get their end event."""
    stop = threading.Event()
    for signum in STOP_SIGNALS:
        signal.signal(signum, lambda _signum, _frame: stop.set())
    return stop


def process_until(frames: Iterable[np.ndarray], pipeline: GesturePipeline, stop: threading.Event) -> None:
    for frame in frames:
        if stop.is_set():
            return
        pipeline.process(frame)
