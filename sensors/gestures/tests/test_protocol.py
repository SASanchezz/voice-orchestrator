import io
import json

from gestures.events import GestureEnd, GestureStart
from gestures.protocol import EventWriter


def written(write: str, *args: object) -> list[dict[str, object]]:
    stream = io.StringIO()
    getattr(EventWriter(stream), write)(*args)
    return [json.loads(line) for line in stream.getvalue().splitlines()]


def test_ready_line() -> None:
    assert written("ready", "canned") == [{"type": "ready", "recognizer": "canned"}]


def test_start_line() -> None:
    [line] = written("gestures", [GestureStart("open_palm", "right", 0.93456, 1000)])
    assert line == {
        "type": "gesture",
        "phase": "start",
        "name": "open_palm",
        "hand": "right",
        "confidence": 0.935,
        "ts": 1000,
    }


def test_end_line_has_held_ms() -> None:
    [line] = written("gestures", [GestureEnd("open_palm", "right", 1840, 2840)])
    assert line == {"type": "gesture", "phase": "end", "name": "open_palm", "hand": "right", "heldMs": 1840, "ts": 2840}


def test_one_line_per_event() -> None:
    events = [GestureStart("victory", "left", 0.9, 1), GestureStart("thumb_up", "right", 0.8, 1)]
    assert len(written("gestures", events)) == 2


def test_error_line() -> None:
    assert written("error", "camera gone") == [{"type": "error", "message": "camera gone"}]


class FlushCounter(io.StringIO):
    def __init__(self) -> None:
        super().__init__()
        self.flushes = 0

    def flush(self) -> None:
        self.flushes += 1


def test_every_line_is_flushed() -> None:
    stream = FlushCounter()
    EventWriter(stream).gestures([GestureStart("victory", "left", 0.9, 1), GestureEnd("victory", "left", 5, 9)])
    assert stream.flushes == 2
