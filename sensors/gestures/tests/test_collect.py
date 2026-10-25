from gestures.collect import COUNTDOWN_MS, Recording
from gestures.landmarks import FEATURE_COUNT, LANDMARK_COUNT, Hand
from gestures.recognizer_canned import Sighting

HAND = Sighting(Hand("right", 0.95, tuple((i / 100, i / 50, 0.0) for i in range(LANDMARK_COUNT))), "none", 0.5)
RECORDING_STARTS = COUNTDOWN_MS


def a_recording() -> Recording:
    return Recording("ok_sign", 0, seconds=2)


def test_nothing_is_recorded_during_the_countdown() -> None:
    recording = a_recording()
    recording.add(RECORDING_STARTS - 1, [HAND])
    assert recording.rows == []


def test_every_hand_becomes_a_row() -> None:
    recording = a_recording()
    recording.add(RECORDING_STARTS, [HAND, HAND])
    assert len(recording.rows) == 2


def test_rows_are_feature_vectors() -> None:
    recording = a_recording()
    recording.add(RECORDING_STARTS, [HAND])
    assert recording.rows[0].shape == (FEATURE_COUNT,)


def test_nothing_is_recorded_after_the_time_is_up() -> None:
    recording = a_recording()
    recording.add(RECORDING_STARTS + 2000, [HAND])
    assert recording.rows == []


def test_done_when_the_time_is_up() -> None:
    assert a_recording().is_done(RECORDING_STARTS + 2000)


def test_not_done_while_recording() -> None:
    assert not a_recording().is_done(RECORDING_STARTS + 1999)


def test_caption_counts_down_in_whole_seconds() -> None:
    assert a_recording().caption(1) == "show ok_sign in 3 ..."


def test_caption_while_recording_shows_time_left_and_samples() -> None:
    recording = a_recording()
    recording.add(RECORDING_STARTS, [HAND])
    assert recording.caption(RECORDING_STARTS + 500).startswith("recording ok_sign: 2 s left, 1 samples")
