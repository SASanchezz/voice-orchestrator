from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

from wake.stream import WINDOW_SIZE
from wake.trained import TRAINED_THRESHOLD, WARM_UP_FRAMES, TrainedWakeWord, TrainedWakeWordDetector

FRAME = np.zeros(1280, dtype=np.int16)


class SteadyStream:
    def window_after(self, frame: np.ndarray) -> np.ndarray:
        return np.ones(WINDOW_SIZE, dtype=np.float32)

    def reset(self) -> None:
        pass


def always_sure() -> TrainedWakeWord:
    """A model that has only ever seen the wake word's windows as all ones, and others as all zeros."""
    rows = np.vstack([np.ones((4, WINDOW_SIZE)), np.zeros((4, WINDOW_SIZE))])
    labels = np.array([1, 1, 1, 1, 0, 0, 0, 0])
    return TrainedWakeWord(make_pipeline(LogisticRegression()).fit(rows, labels), "hey_oracle")


def scores(detector: TrainedWakeWordDetector, frames: int) -> list[float]:
    return [detector.score(FRAME) for _ in range(frames)]


def test_the_first_frames_after_a_reset_are_not_trusted() -> None:
    detector = TrainedWakeWordDetector(always_sure(), SteadyStream())  # type: ignore[arg-type]
    assert scores(detector, WARM_UP_FRAMES) == [0.0] * WARM_UP_FRAMES


def test_after_the_warm_up_the_model_scores_each_frame() -> None:
    detector = TrainedWakeWordDetector(always_sure(), SteadyStream())  # type: ignore[arg-type]
    assert scores(detector, WARM_UP_FRAMES + 1)[-1] > 0.5


def test_a_saved_model_loads_with_its_name(tmp_path: Path) -> None:
    always_sure().save(tmp_path / "hey_oracle.joblib")
    assert TrainedWakeWord.load(tmp_path / "hey_oracle.joblib").name == "hey_oracle"


def test_a_model_trained_here_wakes_only_when_quite_sure() -> None:
    detector = TrainedWakeWordDetector(always_sure(), SteadyStream())  # type: ignore[arg-type]
    assert detector.threshold == TRAINED_THRESHOLD
