from pathlib import Path

import pytest

from gestures.models import ensure_model


def test_existing_model_is_not_downloaded(tmp_path: Path) -> None:
    (tmp_path / "m.task").write_bytes(b"already here")
    assert ensure_model("m.task", "http://invalid.invalid/m.task", tmp_path).read_bytes() == b"already here"


def test_downloads_missing_model(tmp_path: Path) -> None:
    source = tmp_path / "source.task"
    source.write_bytes(b"model bytes")
    target = ensure_model("m.task", source.as_uri(), tmp_path / "models")
    assert target.read_bytes() == b"model bytes"


def test_failed_download_leaves_nothing_behind(tmp_path: Path) -> None:
    missing = (tmp_path / "nope.task").as_uri()
    with pytest.raises(RuntimeError, match="download"):
        ensure_model("m.task", missing, tmp_path / "models")
    assert list((tmp_path / "models").iterdir()) == []
