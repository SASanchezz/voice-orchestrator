import numpy as np

from wake.audio import FRAME_SAMPLES
from wake.stream import WINDOW_SIZE
from wake.windows import (
    BEGUN_FRAMES_BEFORE_END,
    JUST_SAID_FRAMES,
    LEAD_FRAMES,
    OVER_FRAMES_AFTER_JUST_SAID,
    WindowMaker,
    room_level,
)

SPEECH_FRAMES = 10
QUIET_FRAMES = 12
ROOM = 7.0


class CountingStream:
    """Stands in for openWakeWord: each window is filled with the number of the frame it ends on."""

    def __init__(self) -> None:
        self.frames = 0

    def window_after(self, frame: np.ndarray) -> np.ndarray:
        self.frames += 1
        return np.full(WINDOW_SIZE, self.frames - 1, dtype=np.float32)

    def reset(self) -> None:
        self.frames = 0


def spoken_then_quiet() -> np.ndarray:
    speech = np.full(SPEECH_FRAMES * FRAME_SAMPLES, 10_000, dtype=np.int16)
    return np.concatenate([speech, np.zeros(QUIET_FRAMES * FRAME_SAMPLES, dtype=np.int16)])


def wake_windows() -> tuple[np.ndarray, np.ndarray]:
    return WindowMaker(CountingStream(), np.random.default_rng(0)).wake_windows(spoken_then_quiet(), ROOM)


def test_the_windows_to_wake_on_start_where_the_word_ends() -> None:
    said, _begun = wake_windows()
    assert said[0][0] == LEAD_FRAMES + SPEECH_FRAMES - 1


def test_a_few_windows_after_the_word_ends_count_as_just_said() -> None:
    said, _begun = wake_windows()
    assert len(said) == JUST_SAID_FRAMES


def test_windows_with_only_the_start_of_the_word_are_not_woken_on() -> None:
    _said, not_said = wake_windows()
    begun_ends = LEAD_FRAMES + SPEECH_FRAMES - 1 - BEGUN_FRAMES_BEFORE_END
    assert not_said[begun_ends - 1][0] == begun_ends - 1


def test_the_room_once_the_word_is_over_is_not_woken_on() -> None:
    _said, not_said = wake_windows()
    over = LEAD_FRAMES + SPEECH_FRAMES - 1 + JUST_SAID_FRAMES + OVER_FRAMES_AFTER_JUST_SAID
    assert over in {int(row[0]) for row in not_said}


def test_the_frames_just_after_the_word_are_neither_woken_on_nor_not() -> None:
    _said, not_said = wake_windows()
    just_after = LEAD_FRAMES + SPEECH_FRAMES - 1 + JUST_SAID_FRAMES
    assert just_after not in {int(row[0]) for row in not_said}


def test_a_recordings_room_level_is_its_quietest_frames() -> None:
    assert room_level(spoken_then_quiet() + np.int16(0)) == 2.0  # all-zero quiet: never below the floor


def test_other_talk_gives_a_window_for_every_frame_after_the_lead_in() -> None:
    windows = WindowMaker(CountingStream(), np.random.default_rng(0)).other_windows(spoken_then_quiet(), ROOM)
    assert len(windows) > LEAD_FRAMES + SPEECH_FRAMES + QUIET_FRAMES
