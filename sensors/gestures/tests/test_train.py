import io
from pathlib import Path

import joblib
import numpy as np
import pytest

from gestures.classifier import load_model
from gestures.landmarks import FEATURE_COUNT
from gestures.samples import append_samples
from gestures.train import train

SAMPLES_PER_CLASS = 30


def record_cluster(folder: Path, label: str, center: float) -> None:
    """A tiny, easily separable class: noisy rows around one value."""
    noise = np.random.default_rng(len(label)).normal(0, 0.05, (SAMPLES_PER_CLASS, FEATURE_COUNT))
    append_samples(label, list(center + noise), folder)


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    folder = tmp_path / "data"
    record_cluster(folder, "none", 0.0)
    record_cluster(folder, "ok_sign", 1.0)
    return folder


def quietly_train(data_dir: Path, model_path: Path, estimator: str = "knn") -> str:
    report = io.StringIO()
    train(data_dir, model_path, estimator, report)
    return report.getvalue()


def test_reports_validation_accuracy(data_dir: Path, tmp_path: Path) -> None:
    assert "Validation accuracy: 100.0%" in quietly_train(data_dir, tmp_path / "custom.joblib")


def test_reports_a_confusion_matrix(data_dir: Path, tmp_path: Path) -> None:
    assert "Confusion matrix" in quietly_train(data_dir, tmp_path / "custom.joblib")


def test_saved_model_knows_the_labels(data_dir: Path, tmp_path: Path) -> None:
    quietly_train(data_dir, tmp_path / "custom.joblib")
    assert load_model(tmp_path / "custom.joblib").labels == ["none", "ok_sign"]


@pytest.mark.parametrize("estimator", ["knn", "mlp"])
def test_saved_model_classifies_new_rows(data_dir: Path, tmp_path: Path, estimator: str) -> None:
    quietly_train(data_dir, tmp_path / "custom.joblib", estimator)
    [(label, _)] = load_model(tmp_path / "custom.joblib").classify(np.full((1, FEATURE_COUNT), 0.95))
    assert label == "ok_sign"


def test_classify_gives_the_probability(data_dir: Path, tmp_path: Path) -> None:
    quietly_train(data_dir, tmp_path / "custom.joblib")
    [(_, probability)] = load_model(tmp_path / "custom.joblib").classify(np.full((1, FEATURE_COUNT), 0.0))
    assert probability == 1.0


def test_warns_without_none_samples(tmp_path: Path) -> None:
    record_cluster(tmp_path, "ok_sign", 1.0)
    record_cluster(tmp_path, "point_left", -1.0)
    assert "Warning: no `none` samples" in quietly_train(tmp_path, tmp_path / "custom.joblib")


def test_one_gesture_is_not_enough(tmp_path: Path) -> None:
    record_cluster(tmp_path, "ok_sign", 1.0)
    with pytest.raises(RuntimeError, match="at least two"):
        quietly_train(tmp_path, tmp_path / "custom.joblib")


def test_a_class_with_too_few_samples_is_an_error(data_dir: Path, tmp_path: Path) -> None:
    append_samples("point_left", [np.zeros(FEATURE_COUNT)], data_dir)
    with pytest.raises(RuntimeError, match="point_left"):
        quietly_train(data_dir, tmp_path / "custom.joblib")


def test_loading_a_missing_model_says_to_train(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="gestures train"):
        load_model(tmp_path / "custom.joblib")


def test_loading_a_model_of_another_feature_version_says_to_retrain(data_dir: Path, tmp_path: Path) -> None:
    path = tmp_path / "custom.joblib"
    quietly_train(data_dir, path)
    joblib.dump({**joblib.load(path), "feature_version": 0}, path)
    with pytest.raises(RuntimeError, match="Retrain"):
        load_model(path)
