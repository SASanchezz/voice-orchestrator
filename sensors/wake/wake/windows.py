"""Training rows from clips: each row is the 1.28 s window the live listener would score after one 80 ms frame.

A wake word clip gives rows the model should wake on (the word has just ended) and rows it shouldn't: only its start
("hey") has been said, or the word is over and the room is quiet again. Any other clip gives only rows it shouldn't
wake on.

The quiet put around a clip must sound like the room it was recorded in. Your recordings get hiss at your room's own
level: louder made-up hiss around them would be a sound that only your wake word clips have, and the model would learn
that instead of the word. macOS voices have digital silence, so any room's level will do for them."""

from __future__ import annotations

import numpy as np

from .audio import FRAME_SAMPLES, SAMPLE_RATE, frame_levels, whole_frames
from .stream import WINDOW_SIZE, FeatureStream

LEAD_SECONDS = 1.0
WAKE_TAIL_SECONDS = 0.3
# talk is followed by quiet, and that quiet, with the talk still in the window, must not wake it either
OTHER_TAIL_SECONDS = 1.5
# the quiet between words as rooms and mics give it, from a still room to a fan; never digital silence, which the
# embedding model takes oddly
QUIET_LEVELS = (3.0, 150.0)
# a recording's quietest frames are its room; this share of them
ROOM_PERCENTILE = 10
MIN_ROOM_LEVEL = 2.0
# frames at least this loud, relative to the loudest, are speech: how the end of the word is found
SPEECH_LEVEL_SHARE = 0.1
# the windows from the frame the word ends in to a few frames later all mean "just said"
JUST_SAID_FRAMES = 4
# this far before its end, the word is only begun ("hey", "hey or…"), which must not wake
BEGUN_FRAMES_BEFORE_END = 7
# this long after the "just said" windows the word is over: what follows is the room again, which must not wake. The
# frames between are left out: the word has just ended there too
OVER_FRAMES_AFTER_JUST_SAID = 4
LEAD_FRAMES = int(LEAD_SECONDS * SAMPLE_RATE) // FRAME_SAMPLES


def room_level(clip: np.ndarray) -> float:
    """How loud the room is in a recording from the mic: its quietest frames."""
    return max(MIN_ROOM_LEVEL, float(np.percentile(frame_levels(clip), ROOM_PERCENTILE)))


def any_room_level(rng: np.random.Generator) -> float:
    """For a clip with digital silence, such as one by macOS `say`: from a still room to a fan."""
    return float(rng.uniform(*QUIET_LEVELS))


def with_quiet_around(clip: np.ndarray, level: float, rng: np.random.Generator) -> np.ndarray:
    """The clip after a second of quiet at `level`, as the live listener hears speech, and with a short quiet tail."""
    return _padded(clip, level, rng, WAKE_TAIL_SECONDS)


def _padded(clip: np.ndarray, level: float, rng: np.random.Generator, tail_seconds: float) -> np.ndarray:
    lead_samples = LEAD_FRAMES * FRAME_SAMPLES
    tail_samples = int(tail_seconds * SAMPLE_RATE) + FRAME_SAMPLES - len(clip) % FRAME_SAMPLES
    quiet = rng.normal(0, level, lead_samples + tail_samples).astype(np.int16)
    return np.concatenate([quiet[:lead_samples], clip, quiet[lead_samples:]])


class WindowMaker:
    def __init__(self, stream: FeatureStream, rng: np.random.Generator) -> None:
        self._stream = stream
        self._rng = rng

    def wake_windows(self, clip: np.ndarray, quiet_level: float) -> tuple[np.ndarray, np.ndarray]:
        """(rows to wake on, rows not to) for a clip of the wake word, with quiet at `quiet_level` around it."""
        end = LEAD_FRAMES + self._last_speech_frame(clip)
        windows = self.said_windows(clip, quiet_level)
        begun = windows[: max(0, end - BEGUN_FRAMES_BEFORE_END)]
        over = windows[end + JUST_SAID_FRAMES + OVER_FRAMES_AFTER_JUST_SAID :]
        return windows[end : end + JUST_SAID_FRAMES], np.concatenate([begun, over])

    def said_windows(self, clip: np.ndarray, quiet_level: float) -> np.ndarray:
        """Every row of a wake word clip, with quiet around it as the listener would hear it."""
        return self.windows(with_quiet_around(clip, quiet_level, self._rng))

    def other_windows(self, clip: np.ndarray, quiet_level: float) -> np.ndarray:
        return self.windows(_padded(clip, quiet_level, self._rng, OTHER_TAIL_SECONDS))

    def room_after_word(self, clip: np.ndarray) -> np.ndarray:
        """The part of a wake word recording once the word is over: only the room."""
        start = self._last_speech_frame(clip) + JUST_SAID_FRAMES + OVER_FRAMES_AFTER_JUST_SAID
        return clip[start * FRAME_SAMPLES :]

    def windows(self, samples: np.ndarray) -> np.ndarray:
        """One row per whole frame, scored from a fresh stream as the listener would."""
        self._stream.reset()
        rows = [self._stream.window_after(frame) for frame in whole_frames(samples)]
        return np.array(rows).reshape(-1, WINDOW_SIZE)

    @staticmethod
    def _last_speech_frame(clip: np.ndarray) -> int:
        levels = frame_levels(clip)
        loud = np.flatnonzero(levels >= SPEECH_LEVEL_SHARE * levels.max())
        return int(loud[-1]) if len(loud) else len(levels) - 1
