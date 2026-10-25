"""Model files: downloaded once into sensors/gestures/models/ (gitignored)."""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

GESTURE_RECOGNIZER = (
    "gesture_recognizer.task",
    "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/"
    "gesture_recognizer.task",
)


def ensure_model(name: str, url: str, folder: Path = MODELS_DIR) -> Path:
    """Path to the model, downloading it first if it's missing. A partial download never counts as done."""
    target = folder / name
    if target.exists():
        return target
    folder.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(target.suffix + ".part")
    print(f"Downloading {name} …", file=sys.stderr)
    try:
        urllib.request.urlretrieve(url, partial)
    except OSError as e:
        partial.unlink(missing_ok=True)
        raise RuntimeError(f"Couldn't download {name}: {e}. Download {url} to {target} by hand.") from e
    partial.rename(target)
    return target


def gesture_recognizer_model() -> Path:
    return ensure_model(*GESTURE_RECOGNIZER)


def custom_model_path() -> Path:
    """Where `python -m gestures train` saves the classifier, and the custom recognizer loads it from."""
    return MODELS_DIR / "custom.joblib"
