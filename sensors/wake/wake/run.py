"""`python -m wake run`: listens on the mic and prints wake, speech_end and no_speech as JSON lines on stdout."""

from __future__ import annotations

import signal
import sys
import threading
from collections.abc import Iterable
from typing import TextIO

import numpy as np

from .listener import Listener
from .protocol import EventWriter

STOP_SIGNALS = (signal.SIGINT, signal.SIGTERM)


def listen_until_stopped(listener: Listener, audio: Iterable[np.ndarray], out: EventWriter) -> None:
    """Until the audio ends, a stop signal comes, or stdin closes (the orchestrator is gone)."""
    stop = _stop_on_signals()
    _stop_when_closed(sys.stdin, stop)
    listen(listener, audio, out, stop)


def listen(listener: Listener, audio: Iterable[np.ndarray], out: EventWriter, stop: threading.Event) -> None:
    for frame in audio:
        if stop.is_set():
            return
        event = listener.process(frame)
        if event:
            out.event(event)


def _stop_on_signals() -> threading.Event:
    """A flag checked between frames, so sox is always stopped and the mic goes off."""
    stop = threading.Event()
    for signum in STOP_SIGNALS:
        signal.signal(signum, lambda _signum, _frame: stop.set())
    return stop


def _stop_when_closed(commands: TextIO, stop: threading.Event) -> None:
    def wait_for_end() -> None:
        for _line in commands:
            pass
        stop.set()

    threading.Thread(target=wait_for_end, daemon=True).start()
