import wave
from pathlib import Path

import pytest

from wake.recordings import read_samples
from wake.synthetic import SyntheticSpeech, english_voices_in

LISTING = """Anna (German (Germany)) de_DE    # Hallo! Ich heiße Anna.
Bells               en_US    # Hello! My name is Bells.
Eddy (English (US)) en_US    # Hello! My name is Eddy.
Samantha (English (US)) en_US    # Hello! My name is Samantha.
Samantha (English (US)) en_US    # Hello! My name is Samantha.
Daniel (English (UK)) en_GB    # Hello! My name is Daniel.
"""


def test_english_voices_are_each_listed_once_without_other_languages_or_joke_voices() -> None:
    assert english_voices_in(LISTING) == ["Daniel (English (UK))", "Eddy (English (US))", "Samantha (English (US))"]


def write_wav(path: Path, samples: int) -> None:
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16_000)
        wav.writeframes(b"\x01\x00" * samples)


def say_one_second(line: str, voice: str, rate: int, path: Path) -> None:
    write_wav(path, 16_000)


def test_a_near_empty_clip_made_earlier_is_made_again(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """`say` sometimes writes only its header; such a clip in the cache isn't used."""
    monkeypatch.setattr(SyntheticSpeech, "_say", staticmethod(say_one_second))
    speech = SyntheticSpeech(tmp_path, ["Samantha"])
    write_wav(speech.near_miss_clips()[0], 171)
    assert len(read_samples(speech.near_miss_clips()[0])) == 16_000
