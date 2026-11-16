import io
import json
from collections.abc import Callable

from wake.listener import Event
from wake.protocol import EventWriter


def written(write: Callable[[EventWriter], None]) -> dict[str, object]:
    stream = io.StringIO()
    write(EventWriter(stream))
    return json.loads(stream.getvalue())


def test_ready_names_the_model() -> None:
    assert written(lambda out: out.ready("oracle")) == {"type": "ready", "model": "oracle"}


def test_a_wake_carries_its_rounded_score() -> None:
    assert written(lambda out: out.event(Event("wake", 0.87654))) == {"type": "wake", "score": 0.877}


def test_speech_end_has_no_score() -> None:
    assert written(lambda out: out.event(Event("speech_end"))) == {"type": "speech_end"}


def test_errors_carry_their_message() -> None:
    assert written(lambda out: out.error("no model")) == {"type": "error", "message": "no model"}


def test_each_message_is_one_line() -> None:
    stream = io.StringIO()
    EventWriter(stream).ready("oracle")
    assert stream.getvalue().count("\n") == 1
