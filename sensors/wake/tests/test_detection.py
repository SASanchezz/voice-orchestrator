"""The real models on speech made by macOS `say`: skipped where `say` or the downloaded models are missing."""

import shutil
import subprocess
from pathlib import Path

import numpy as np
import pytest

from wake.audio import FRAME_SAMPLES, frames, open_wav
from wake.listener import STOP_WORD, WAKE, Listener, ListenerConfig
from wake.models import RESOURCES_DIR, SileroVoiceDetector, WakeWordDetector

BUILTIN = "hey_jarvis"
SILENCE = np.zeros(FRAME_SAMPLES * 12, dtype=np.int16)  # about a second

needs_models = pytest.mark.skipif(
    shutil.which("say") is None or not list(RESOURCES_DIR.glob(f"{BUILTIN}*.onnx")),
    reason=f"needs macOS say and `python -m wake setup --builtin {BUILTIN}`",
)


def spoken(tmp_path: Path, text: str) -> list[np.ndarray]:
    """`text` said by macOS, with a second of silence around it."""
    wav = tmp_path / "said.wav"
    subprocess.run(["say", "-o", str(wav), "--data-format=LEI16@16000", text], check=True)
    speech = np.concatenate(list(frames(open_wav(str(wav)))))
    audio = np.concatenate([SILENCE, speech, SILENCE])
    return [audio[start : start + FRAME_SAMPLES] for start in range(0, len(audio) - FRAME_SAMPLES + 1, FRAME_SAMPLES)]


def heard(audio: list[np.ndarray]) -> list[str]:
    listener = Listener(WakeWordDetector(BUILTIN), SileroVoiceDetector(), ListenerConfig())
    return [event.type for event in map(listener.process, audio) if event]


def wakes(audio: list[np.ndarray]) -> int:
    return heard(audio).count(WAKE)


@needs_models
def test_the_wake_word_said_aloud_wakes_it(tmp_path: Path) -> None:
    assert wakes(spoken(tmp_path, "Hey Jarvis.")) == 1


@needs_models
def test_ordinary_speech_does_not_wake_it(tmp_path: Path) -> None:
    assert wakes(spoken(tmp_path, "Please run the tests in the billing project and tell me when they pass.")) == 0


@needs_models
def test_the_wake_word_said_again_ends_the_message(tmp_path: Path) -> None:
    said = "Hey Jarvis. [[slnc 500]] Run the tests in billing. [[slnc 300]] Hey Jarvis."
    assert heard(spoken(tmp_path, said)) == [WAKE, STOP_WORD]
