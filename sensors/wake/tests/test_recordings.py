from pathlib import Path

from wake.recordings import OTHER_LABEL, WAKE_LABEL, Counts, Recordings


def test_no_recordings_yet_counts_none() -> None:
    assert Recordings(Path("/nonexistent")).counts() == Counts(wake=0, other=0)


def test_recordings_are_counted_by_what_they_hold(tmp_path: Path) -> None:
    recordings = Recordings(tmp_path)
    for label in (WAKE_LABEL, WAKE_LABEL, OTHER_LABEL):
        recordings.new_clip_path(label).write_bytes(b"")
    assert recordings.counts() == Counts(wake=2, other=1)


def test_a_new_recording_goes_into_its_kinds_folder(tmp_path: Path) -> None:
    assert Recordings(tmp_path).new_clip_path(OTHER_LABEL).parent == tmp_path / OTHER_LABEL
