"""`python -m gestures run`: no window, just gesture events as JSON lines on stdout."""

from __future__ import annotations

import signal

from .camera import CameraError
from .pipeline import SensorSettings, open_pipeline
from .protocol import EventWriter
from .recognizer_canned import RECOGNIZER_NAME


def run_sensor(settings: SensorSettings, out: EventWriter) -> None:
    try:
        _run(settings, out)
    except (CameraError, RuntimeError) as e:
        out.error(str(e))
        raise


def _run(settings: SensorSettings, out: EventWriter) -> None:
    # The orchestrator stops the sensor with SIGTERM; as KeyboardInterrupt, open holds still get their end event.
    signal.signal(signal.SIGTERM, signal.default_int_handler)
    with open_pipeline(settings, out) as (cam, pipeline):
        out.ready(RECOGNIZER_NAME)
        for frame in cam.frames():
            pipeline.process(frame)
