import io
import json
from pathlib import Path

import cv2
import numpy as np
import pytest

from gestures.protocol import EventWriter
from gestures.snapshots import SnapshotRequest, SnapshotRequests, SnapshotTaker, fit_longest_edge, read_request

FRAME = np.zeros((720, 1280, 3), dtype=np.uint8)


def command(request_id: str, path: str) -> str:
    return json.dumps({"cmd": "snapshot", "id": request_id, "path": path}) + "\n"


def requests_from(*lines: str) -> SnapshotRequests:
    requests = SnapshotRequests()
    requests.read_all(lines)
    return requests


def served(requests: SnapshotRequests, frame: np.ndarray = FRAME) -> list[dict[str, object]]:
    """Answers the waiting requests with one frame; returns the lines written."""
    stream = io.StringIO()
    list(SnapshotTaker(requests, EventWriter(stream)).serving([frame]))
    return [json.loads(line) for line in stream.getvalue().splitlines()]


def test_a_snapshot_command_is_read() -> None:
    assert read_request(command("abc", "/tmp/abc.jpg")) == SnapshotRequest("abc", "/tmp/abc.jpg")


def test_another_command_is_rejected() -> None:
    with pytest.raises(ValueError):
        read_request('{"cmd":"reboot"}')


def test_a_relative_path_is_rejected() -> None:
    with pytest.raises(ValueError):
        read_request(command("abc", "state/camera/abc.jpg"))


def test_a_line_that_isnt_json_is_rejected() -> None:
    with pytest.raises(ValueError):
        read_request("hello")


def test_unreadable_commands_are_skipped() -> None:
    requests = requests_from("hello\n", command("abc", "/tmp/abc.jpg"))
    assert requests.take_all() == [SnapshotRequest("abc", "/tmp/abc.jpg")]


def test_taken_requests_are_gone() -> None:
    requests = requests_from(command("abc", "/tmp/abc.jpg"))
    requests.take_all()
    assert requests.take_all() == []


def test_a_snapshot_is_written_as_a_jpeg(tmp_path: Path) -> None:
    path = str(tmp_path / "abc.jpg")
    served(requests_from(command("abc", path)))
    assert cv2.imread(path).shape == FRAME.shape


def test_a_written_snapshot_is_answered(tmp_path: Path) -> None:
    path = str(tmp_path / "abc.jpg")
    assert served(requests_from(command("abc", path))) == [{"type": "snapshot", "id": "abc", "path": path, "ok": True}]


def test_a_snapshot_that_cant_be_written_is_answered_as_failed(tmp_path: Path) -> None:
    path = str(tmp_path / "missing-folder" / "abc.jpg")
    [answer] = served(requests_from(command("abc", path)))
    assert answer["ok"] is False


def test_frames_pass_through_unchanged() -> None:
    taker = SnapshotTaker(requests_from(), EventWriter(io.StringIO()))
    assert list(taker.serving([FRAME])) == [FRAME]


def test_a_large_frame_is_shrunk_to_the_longest_edge() -> None:
    large = np.zeros((2160, 3840, 3), dtype=np.uint8)
    assert fit_longest_edge(large, 1568).shape == (882, 1568, 3)


def test_a_small_frame_keeps_its_size() -> None:
    assert fit_longest_edge(FRAME, 1568).shape == FRAME.shape
