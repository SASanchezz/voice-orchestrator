"""Recorded feature rows, one CSV per gesture label in sensors/gestures/data/ (gitignored)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .landmarks import FEATURE_COUNT

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DECIMALS = "%.5f"


@dataclass(frozen=True)
class Samples:
    rows: np.ndarray  # (count, FEATURE_COUNT)
    labels: np.ndarray  # (count,), one label per row

    def counts(self) -> dict[str, int]:
        names, counts = np.unique(self.labels, return_counts=True)
        return {str(name): int(count) for name, count in zip(names, counts, strict=True)}


def append_samples(label: str, rows: list[np.ndarray], folder: Path = DATA_DIR) -> Path:
    """Adds rows to the label's file, so several recording sessions add up."""
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{label}.csv"
    with path.open("a") as file:
        np.savetxt(file, np.array(rows).reshape(-1, FEATURE_COUNT), delimiter=",", fmt=DECIMALS)
    return path


def load_samples(folder: Path = DATA_DIR) -> Samples:
    files = sorted(folder.glob("*.csv"))
    if not files:
        raise RuntimeError(f"No samples in {folder}. Record some first: python -m gestures collect --label <name>")
    parts = [_load_file(path) for path in files]
    return Samples(np.concatenate([rows for rows, _ in parts]), np.concatenate([labels for _, labels in parts]))


def _load_file(path: Path) -> tuple[np.ndarray, np.ndarray]:
    rows = np.loadtxt(path, delimiter=",", ndmin=2).reshape(-1, FEATURE_COUNT)
    return rows, np.full(len(rows), path.stem)
