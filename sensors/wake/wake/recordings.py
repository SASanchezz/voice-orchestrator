"""Your own recordings for training, as 16 kHz mono WAV files in data/<label>/ (gitignored, never sent anywhere):
`wake` is you saying the wake word, `other` is you talking about anything else, and the room around you."""

from __future__ import annotations

import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .audio import SOX_FORMAT, open_wav

WAKE_LABEL = "wake"
OTHER_LABEL = "other"
LABELS = (WAKE_LABEL, OTHER_LABEL)
RECORD_SECONDS = {WAKE_LABEL: 2.5, OTHER_LABEL: 6.0}
TRY_SECONDS = 3.0


@dataclass(frozen=True)
class Counts:
    wake: int
    other: int


class Recordings:
    def __init__(self, root: Path) -> None:
        self._root = root

    def counts(self) -> Counts:
        return Counts(wake=len(self.clips(WAKE_LABEL)), other=len(self.clips(OTHER_LABEL)))

    def clips(self, label: str) -> list[Path]:
        return sorted((self._root / label).glob("*.wav"))

    def new_clip_path(self, label: str) -> Path:
        folder = self._root / label
        folder.mkdir(parents=True, exist_ok=True)
        return folder / f"{time.strftime('%Y%m%d-%H%M%S')}-{time.time_ns() % 1_000_000:06d}.wav"


def record(path: Path, seconds: float, record_bin: str) -> None:
    """`seconds` from the default mic into `path`, with the same sox as the listener."""
    command = [record_bin, *SOX_FORMAT, str(path), "trim", "0", str(seconds)]
    done = subprocess.run(command, stderr=subprocess.PIPE, text=True, check=False)
    if done.returncode != 0:
        raise RuntimeError(f"{record_bin} couldn't record: {done.stderr.strip() or done.returncode}")


def read_samples(path: Path) -> np.ndarray:
    return np.frombuffer(open_wav(str(path)).read(), dtype=np.int16)
