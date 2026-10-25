from pathlib import Path

import numpy as np
import pytest

from gestures.landmarks import FEATURE_COUNT
from gestures.samples import append_samples, load_samples


def rows(count: int, value: float) -> list[np.ndarray]:
    return [np.full(FEATURE_COUNT, value) for _ in range(count)]


def test_label_comes_from_the_file_name(tmp_path: Path) -> None:
    append_samples("ok_sign", rows(2, 0.5), tmp_path)
    assert load_samples(tmp_path).counts() == {"ok_sign": 2}


def test_sessions_add_up(tmp_path: Path) -> None:
    append_samples("ok_sign", rows(2, 0.5), tmp_path)
    append_samples("ok_sign", rows(3, 0.5), tmp_path)
    assert load_samples(tmp_path).counts() == {"ok_sign": 5}


def test_rows_keep_their_values(tmp_path: Path) -> None:
    append_samples("ok_sign", rows(1, 0.25), tmp_path)
    assert np.allclose(load_samples(tmp_path).rows, 0.25)


def test_a_single_row_loads_as_a_row(tmp_path: Path) -> None:
    append_samples("ok_sign", rows(1, 0.25), tmp_path)
    assert load_samples(tmp_path).rows.shape == (1, FEATURE_COUNT)


def test_labels_line_up_with_rows(tmp_path: Path) -> None:
    append_samples("none", rows(1, 0.0), tmp_path)
    append_samples("ok_sign", rows(2, 1.0), tmp_path)
    assert list(load_samples(tmp_path).labels) == ["none", "ok_sign", "ok_sign"]


def test_no_samples_is_an_error(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="No samples"):
        load_samples(tmp_path)
