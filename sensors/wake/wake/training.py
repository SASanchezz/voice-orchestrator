"""`python -m wake train`: a wake word model from your recordings and macOS's voices.

It is first trained without a quarter of your recordings and checked on them, as the live listener would score them,
so you see how well it hears you, and whether your quiet room alone wakes it; then trained again on everything for the
saved model."""

from __future__ import annotations

import sys
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import TextIO

import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.preprocessing import StandardScaler

from .augment import Augmenter
from .recordings import OTHER_LABEL, WAKE_LABEL, Recordings, read_samples
from .stream import WINDOW_SIZE, FeatureStream
from .synthetic import SyntheticSpeech
from .trained import WARM_UP_FRAMES, TrainedWakeWord
from .windows import WindowMaker, any_room_level, room_level

MIN_WAKE_CLIPS = 5
CHECKED_SHARE = 0.25
MIN_CLIPS_TO_CHECK = 4
SEED = 0  # the same split and weights every run, so two runs can be compared
WAKE, NOT_WAKE = 1, 0
# a recording whose word runs to its end leaves too little room after it to check
MIN_ROOM_SAMPLES = 8_000  # half a second
# a new version whenever what a row holds changes, so old cached rows aren't used
ROWS_SUFFIX = ".rows-v2.npy"


@dataclass(frozen=True)
class TrainingReport:
    model: str
    caught: int
    checked_wake: int
    false_wakes: int
    checked_other: int
    quiet_false_wakes: int
    checked_quiet: int


@dataclass
class Rows:
    wake: list[np.ndarray]
    not_wake: list[np.ndarray]

    def plus(self, other: Rows) -> Rows:
        return Rows(self.wake + other.wake, self.not_wake + other.not_wake)


@dataclass(frozen=True)
class YourClips:
    wake: list[np.ndarray]
    other: list[np.ndarray]


QuietLevel = Callable[[np.ndarray], float]


class Trainer:
    def __init__(self, recordings: Recordings, synthetic: SyntheticSpeech, log: TextIO = sys.stderr) -> None:
        self._recordings = recordings
        self._synthetic = synthetic
        self._log = log
        self._rng = np.random.default_rng(SEED)
        self._windows = WindowMaker(FeatureStream(), self._rng)

    def train(self, model_path: Path, threshold: float) -> TrainingReport:
        yours = self._your_clips()
        augment = Augmenter(yours.other, self._rng)
        synthetic = self._synthetic_rows(augment)
        kept, checked = self._held_back(yours)
        checking = self._fit(synthetic.plus(self._your_rows(kept, augment)), model_path.stem)
        report = self._check(checking, checked, threshold)
        self._fit(synthetic.plus(self._your_rows(yours, augment)), model_path.stem).save(model_path)
        print(f"Saved {model_path}", file=self._log)
        return report

    def _your_clips(self) -> YourClips:
        wake = [read_samples(path) for path in self._recordings.clips(WAKE_LABEL)]
        if len(wake) < MIN_WAKE_CLIPS:
            raise RuntimeError(f"Record the wake word at least {MIN_WAKE_CLIPS} times first (you have {len(wake)}).")
        return YourClips(wake, [read_samples(path) for path in self._recordings.clips(OTHER_LABEL)])

    def _synthetic_rows(self, augment: Augmenter) -> Rows:
        print("Making macOS voices say the wake word and other sentences (once)…", file=self._log)
        said = [read_samples(path) for path in self._synthetic.wake_clips()]
        other_paths = self._synthetic.near_miss_clips() + self._synthetic.ordinary_clips()
        print(f"Turning {len(said) + len(other_paths)} synthetic clips into training rows…", file=self._log)
        variants = [variant for clip in said for variant in augment.synthetic_variants(clip)]
        rows = self._rows(variants, [], self._any_room_level)
        rows.not_wake.extend(self._cached_other_windows(path) for path in other_paths)
        return rows

    def _cached_other_windows(self, path: Path) -> np.ndarray:
        """Synthetic clips never change, so their rows are kept beside them, and training again is quick."""
        rows_path = path.with_suffix(ROWS_SUFFIX)
        if rows_path.exists() and rows_path.stat().st_mtime >= path.stat().st_mtime:  # a clip made again needs new rows
            return np.load(rows_path)
        rows = self._windows.other_windows(read_samples(path), any_room_level(self._rng))
        np.save(rows_path, rows)
        return rows

    def _your_rows(self, yours: YourClips, augment: Augmenter) -> Rows:
        # Your wake word recordings are used once each, while your other talk gets louder, quieter and mixed copies.
        # Copies of the wake word made your voice itself mean the wake word: any word you said woke it.
        other = [variant for clip in yours.other for variant in augment.your_variants(clip)]
        return self._rows(yours.wake, other, room_level)

    def _rows(self, wake_clips: list[np.ndarray], other_clips: list[np.ndarray], quiet: QuietLevel) -> Rows:
        """Each clip with quiet around it at the level `quiet` gives for it."""
        rows = Rows([], [self._windows.other_windows(clip, quiet(clip)) for clip in other_clips])
        for clip in wake_clips:
            said, not_said = self._windows.wake_windows(clip, quiet(clip))
            rows.wake.append(said)
            rows.not_wake.append(not_said)
        return rows

    def _any_room_level(self, _clip: np.ndarray) -> float:
        """macOS voices have digital silence: any room's quiet goes around them."""
        return any_room_level(self._rng)

    def _held_back(self, yours: YourClips) -> tuple[YourClips, YourClips]:
        """(your clips to train on, your clips to check the model on)."""
        wake_kept, wake_checked = self._split(yours.wake)
        other_kept, other_checked = self._split(yours.other)
        return YourClips(wake_kept, other_kept), YourClips(wake_checked, other_checked)

    def _split(self, clips: list[np.ndarray]) -> tuple[list[np.ndarray], list[np.ndarray]]:
        """(clips to train on, clips to check on); too few to spare any are all trained on."""
        if len(clips) < MIN_CLIPS_TO_CHECK:
            return clips, []
        order = self._rng.permutation(len(clips))
        checked = max(1, round(len(clips) * CHECKED_SHARE))
        return [clips[i] for i in order[checked:]], [clips[i] for i in order[:checked]]

    def _fit(self, rows: Rows, name: str) -> TrainedWakeWord:
        wake, not_wake = self._stacked(rows.wake), self._stacked(rows.not_wake)
        print(f"Training on {len(wake)} wake and {len(not_wake)} other rows…", file=self._log)
        features = np.vstack([wake, not_wake])
        labels = np.concatenate([np.full(len(wake), WAKE), np.full(len(not_wake), NOT_WAKE)])
        return TrainedWakeWord(self._classifier().fit(features, labels), name)

    @staticmethod
    def _stacked(parts: list[np.ndarray]) -> np.ndarray:
        return np.vstack([part for part in parts if len(part)] or [np.empty((0, WINDOW_SIZE))])

    @staticmethod
    def _classifier() -> Pipeline:
        network = MLPClassifier((64,), alpha=1e-3, early_stopping=True, max_iter=300, random_state=SEED)
        return make_pipeline(StandardScaler(), network)

    def _check(self, model: TrainedWakeWord, checked: YourClips, threshold: float) -> TrainingReport:
        said = [self._windows.said_windows(clip, room_level(clip)) for clip in checked.wake]
        other = [self._windows.other_windows(clip, room_level(clip)) for clip in checked.other]
        rooms = [room for clip in checked.wake if len(room := self._windows.room_after_word(clip)) >= MIN_ROOM_SAMPLES]
        quiet = [self._windows.other_windows(room, room_level(room)) for room in rooms]
        caught, false_wakes = self._woken(model, said, threshold), self._woken(model, other, threshold)
        quiet_false_wakes = self._woken(model, quiet, threshold)
        return TrainingReport(model.name, caught, len(said), false_wakes, len(other), quiet_false_wakes, len(quiet))

    def _woken(self, model: TrainedWakeWord, clips: list[np.ndarray], threshold: float) -> int:
        return sum(self._wakes(model, windows, threshold) for windows in clips)

    @staticmethod
    def _wakes(model: TrainedWakeWord, windows: np.ndarray, threshold: float) -> bool:
        """As the listener scores a clip: not in the first frames after a reset."""
        return bool(model.probabilities(windows[WARM_UP_FRAMES:]).max() >= threshold)
