"""openWakeWord's models: the shared audio models and the voice detector (downloaded once by `setup`, never while
listening), and the wake word model itself."""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

import numpy as np
import openwakeword
from openwakeword.model import Model
from openwakeword.utils import download_file, download_models
from openwakeword.vad import VAD

from .stream import FeatureStream
from .paths import TRAINED_SUFFIX
from .trained import TrainedWakeWord, TrainedWakeWordDetector

RESOURCES_DIR = Path(openwakeword.__file__).resolve().parent / "resources" / "models"
MODEL_SUFFIXES = (".onnx", ".tflite")
# openWakeWord's own models are scored for this
OPENWAKEWORD_THRESHOLD = 0.5
VAD_FRAME_SAMPLES = 640  # 40 ms: two Silero steps per 80 ms frame
SETUP_HINT = "Run `python -m wake setup` in sensors/wake first."
TRAIN_HINT = "Train it in the web UI (⚙ › Train wake word), or try a built-in one with --model hey_jarvis."


def download_base_models(builtin: str | None) -> None:
    """The audio feature models and Silero VAD as ONNX, and a built-in wake word if one is named."""
    RESOURCES_DIR.mkdir(parents=True, exist_ok=True)
    for url in _base_model_urls():
        if not (RESOURCES_DIR / url.rsplit("/", 1)[-1]).exists():
            download_file(url, str(RESOURCES_DIR))
    if builtin:
        download_models([builtin], str(RESOURCES_DIR))


def _base_model_urls() -> list[str]:
    features = [model["download_url"].replace(".tflite", ".onnx") for model in openwakeword.FEATURE_MODELS.values()]
    voice = [model["download_url"] for model in openwakeword.VAD_MODELS.values()]
    return features + voice


class NamedDetector(Protocol):
    @property
    def name(self) -> str: ...

    @property
    def threshold(self) -> float:
        """How sure it must be to wake, unless --threshold says otherwise."""
        ...

    def score(self, frame: np.ndarray) -> float: ...

    def reset(self) -> None: ...


def open_detector(model: str) -> NamedDetector:
    """A model trained here (.joblib), an openWakeWord .onnx file, or one of openWakeWord's built-in names."""
    if model.endswith(TRAINED_SUFFIX):
        return open_trained_detector(Path(model))
    return WakeWordDetector(model)


def open_trained_detector(path: Path) -> TrainedWakeWordDetector:
    _require_base_models()
    if not path.exists():
        raise RuntimeError(f"No wake word model at {path}. {TRAIN_HINT}")
    return TrainedWakeWordDetector(TrainedWakeWord.load(path), FeatureStream())


class WakeWordDetector:
    """How sure openWakeWord is that the wake word was just said, from 0 to 1."""

    def __init__(self, model: str) -> None:
        _require_base_models()
        self._model = Model(wakeword_models=[_existing_model(model)], inference_framework="onnx")

    @property
    def name(self) -> str:
        return next(iter(self._model.models))

    @property
    def threshold(self) -> float:
        return OPENWAKEWORD_THRESHOLD

    def score(self, frame: np.ndarray) -> float:
        return float(max(self._model.predict(frame).values()))

    def reset(self) -> None:
        self._model.reset()


class SileroVoiceDetector:
    """How likely a frame is speech, from 0 to 1; used only between the wake word and the end of your message."""

    def __init__(self) -> None:
        _require_base_models()
        self._vad = VAD()

    def speech_probability(self, frame: np.ndarray) -> float:
        return float(self._vad.predict(frame, frame_size=VAD_FRAME_SAMPLES))

    def reset(self) -> None:
        self._vad.reset_states()


def _require_base_models() -> None:
    missing = [url for url in _base_model_urls() if not (RESOURCES_DIR / url.rsplit("/", 1)[-1]).exists()]
    if missing:
        raise RuntimeError(f"openWakeWord's base models aren't downloaded. {SETUP_HINT}")


def _existing_model(model: str) -> str:
    """A model file must exist; a bare name (hey_jarvis) is one of openWakeWord's built-in models."""
    is_file = model.endswith(MODEL_SUFFIXES)
    if is_file and not model.endswith(".onnx"):
        raise RuntimeError(f"{model}: only .onnx models run on macOS; use the .onnx file training made.")
    if is_file and not Path(model).exists():
        raise RuntimeError(f"No wake word model at {model}. {TRAIN_HINT}")
    if not is_file and not _builtin_downloaded(model):
        raise RuntimeError(f'Built-in model "{model}" isn\'t downloaded: python -m wake setup --builtin {model}')
    return model


def _builtin_downloaded(name: str) -> bool:
    return any(name in Path(path).name and Path(path).exists() for path in openwakeword.get_pretrained_model_paths("onnx"))
