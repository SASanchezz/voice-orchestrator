"""16 kHz mono 16-bit audio in 80 ms frames, from the mic (through sox, like the orchestrator's own recordings) or a WAV
file. Nothing here keeps or writes audio."""

from __future__ import annotations

import io
import subprocess
import wave
from collections.abc import Iterator
from contextlib import contextmanager
from typing import BinaryIO

import numpy as np

SAMPLE_RATE = 16_000
FRAME_SAMPLES = 1280  # 80 ms, the step openWakeWord works in
BYTES_PER_SAMPLE = 2
FRAME_BYTES = FRAME_SAMPLES * BYTES_PER_SAMPLE
SOX_FORMAT = ["-q", "-c", "1", "-r", str(SAMPLE_RATE), "-b", "16", "-e", "signed-integer"]
SOX_RAW_FORMAT = [*SOX_FORMAT, "-t", "raw", "-"]
STOP_WAIT_SECONDS = 2


def whole_frames(samples: np.ndarray) -> np.ndarray:
    """The samples as rows of one 80 ms frame each; a part-frame at the end is dropped."""
    return samples[: len(samples) // FRAME_SAMPLES * FRAME_SAMPLES].reshape(-1, FRAME_SAMPLES)


def frame_levels(samples: np.ndarray) -> np.ndarray:
    """How loud each whole 80 ms frame is (RMS)."""
    return np.sqrt(np.mean(whole_frames(samples).astype(np.float64) ** 2, axis=1))


def frames(stream: BinaryIO) -> Iterator[np.ndarray]:
    """Whole frames until the stream ends; a part-frame at the very end is dropped."""
    while len(chunk := _read_exactly(stream, FRAME_BYTES)) == FRAME_BYTES:
        yield np.frombuffer(chunk, dtype=np.int16)


def _read_exactly(stream: BinaryIO, size: int) -> bytes:
    """A pipe can hand over less than asked for; read on until there is a whole frame or the stream has ended."""
    chunk = b""
    while len(chunk) < size:
        more = stream.read(size - len(chunk))
        if not more:
            break
        chunk += more
    return chunk


@contextmanager
def open_mic(record_bin: str) -> Iterator[BinaryIO]:
    """sox recording from the default input into a pipe; it is stopped when the block ends, so the mic goes off."""
    sox = subprocess.Popen([record_bin, *SOX_RAW_FORMAT], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    if sox.stdout is None:
        raise RuntimeError(f"{record_bin} gave no audio pipe")
    try:
        yield sox.stdout
    finally:
        _stop(sox)


def _stop(sox: subprocess.Popen[bytes]) -> None:
    sox.terminate()
    try:
        sox.wait(STOP_WAIT_SECONDS)
    except subprocess.TimeoutExpired:
        sox.kill()


def open_wav(path: str) -> BinaryIO:
    """A 16 kHz mono 16-bit WAV file's samples, for trying the listener on a recording instead of the mic."""
    with wave.open(path, "rb") as wav:
        expected = (1, BYTES_PER_SAMPLE, SAMPLE_RATE)
        if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) != expected:
            raise RuntimeError(f"{path} must be 16 kHz mono 16-bit")
        return io.BytesIO(wav.readframes(wav.getnframes()))
