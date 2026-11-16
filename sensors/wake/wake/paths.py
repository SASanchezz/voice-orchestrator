"""Where the wake listener keeps its models and your training recordings. Kept free of heavy imports, so a training
recording starts the moment you click."""

from __future__ import annotations

from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = PACKAGE_DIR / "models"
DATA_DIR = PACKAGE_DIR / "data"
TRAINED_SUFFIX = ".joblib"
DEFAULT_MODEL = str(MODELS_DIR / f"hey_oracle{TRAINED_SUFFIX}")
