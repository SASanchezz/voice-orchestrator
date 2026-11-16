import io
import wave
from pathlib import Path

import pytest

from wake.audio import FRAME_BYTES, FRAME_SAMPLES, SAMPLE_RATE, frames, open_wav


class TricklingPipe(io.RawIOBase):
    """Hands out at most a few bytes per read, as a pipe may."""

    def __init__(self, data: bytes, step: int) -> None:
        self._data = data
        self._step = step

    def readable(self) -> bool:
        return True

    def read(self, size: int = -1) -> bytes:
        chunk, self._data = self._data[: min(size, self._step)], self._data[min(size, self._step) :]
        return chunk


def write_wav(path: Path, rate: int, samples: int) -> str:
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(b"\x00\x00" * samples)
    return str(path)


def test_frames_are_80_ms_of_samples() -> None:
    first = next(frames(io.BytesIO(b"\x00" * FRAME_BYTES)))
    assert first.shape == (FRAME_SAMPLES,)


def test_a_part_frame_at_the_end_is_dropped() -> None:
    assert len(list(frames(io.BytesIO(b"\x00" * (FRAME_BYTES * 2 + 10))))) == 2


def test_short_reads_from_a_pipe_still_make_whole_frames() -> None:
    assert len(list(frames(TricklingPipe(b"\x00" * FRAME_BYTES * 3, step=7)))) == 3


def test_a_wav_file_gives_its_samples(tmp_path: Path) -> None:
    wav = open_wav(write_wav(tmp_path / "one.wav", SAMPLE_RATE, FRAME_SAMPLES))
    assert len(list(frames(wav))) == 1


def test_a_wav_at_another_rate_is_refused(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError):
        open_wav(write_wav(tmp_path / "cd.wav", 44_100, FRAME_SAMPLES))
