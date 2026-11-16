"""`python -m wake samples | record | train | try`: training your own wake word, as the web UI's dialog does it.
Each prints one JSON line on stdout (see protocol.py); progress goes to stderr.

openWakeWord and scikit-learn take about a second to load, so they are loaded only once a recording has been made:
the mic must be on as soon as you click Record and start speaking."""

from __future__ import annotations

import argparse
import dataclasses
import sys
import tempfile
from pathlib import Path

import numpy as np

from .audio import whole_frames
from .paths import DATA_DIR, DEFAULT_MODEL, TRAINED_SUFFIX
from .protocol import EventWriter
from .recordings import LABELS, RECORD_SECONDS, TRY_SECONDS, WAKE_LABEL, Recordings, read_samples, record

SPEECH_PROBABILITY = 0.5
NOT_TRAINED = "There is no trained model to try yet: record yourself, then train."
NO_SPEECH_HINT = "Didn't hear you say anything, so that recording wasn't kept. Check the mic and try again."


def add_training_commands(commands: argparse._SubParsersAction) -> None:  # type: ignore[type-arg]
    samples = commands.add_parser("samples", help="how many recordings there are, and whether a model is trained")
    samples.set_defaults(handler=_samples)

    recorder = commands.add_parser("record", help="record one training clip from the mic")
    recorder.add_argument("--label", choices=LABELS, required=True, help="wake: the wake word; other: anything else")
    recorder.add_argument("--record-bin", default="rec", help="sox's recorder (default rec)")
    recorder.set_defaults(handler=_record)

    train = commands.add_parser("train", help="train the wake word model on your recordings and macOS's voices")
    train.set_defaults(handler=_train)

    tryout = commands.add_parser("try", help="record a few seconds and say how sure the model is it heard the word")
    tryout.add_argument("--model", default=DEFAULT_MODEL, help="wake word model (default: the trained one)")
    tryout.add_argument("--record-bin", default="rec", help="sox's recorder (default rec)")
    tryout.set_defaults(handler=_try)


def _samples(_args: argparse.Namespace) -> None:
    _write_samples(Recordings(DATA_DIR))


def _record(args: argparse.Namespace) -> None:
    recordings = Recordings(DATA_DIR)
    path = recordings.new_clip_path(args.label)
    record(path, RECORD_SECONDS[args.label], args.record_bin)
    if args.label == WAKE_LABEL and not _has_speech(read_samples(path)):
        path.unlink()
        raise RuntimeError(NO_SPEECH_HINT)
    _write_samples(recordings)


def _write_samples(recordings: Recordings) -> None:
    counts = recordings.counts()
    EventWriter(sys.stdout).samples(counts.wake, counts.other, Path(DEFAULT_MODEL).exists())


def _has_speech(clip: np.ndarray) -> bool:
    from .models import SileroVoiceDetector

    voice = SileroVoiceDetector()
    return any(voice.speech_probability(frame) >= SPEECH_PROBABILITY for frame in whole_frames(clip))


def _train(_args: argparse.Namespace) -> None:
    from .synthetic import SyntheticSpeech, english_voices
    from .training import Trainer

    synthetic = SyntheticSpeech(DATA_DIR / "synthetic", english_voices())
    from .trained import TRAINED_THRESHOLD

    report = Trainer(Recordings(DATA_DIR), synthetic).train(Path(DEFAULT_MODEL), TRAINED_THRESHOLD)
    EventWriter(sys.stdout).trained(dataclasses.asdict(report))


def _try(args: argparse.Namespace) -> None:
    if args.model.endswith(TRAINED_SUFFIX) and not Path(args.model).exists():
        raise RuntimeError(NOT_TRAINED)
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "try.wav"
        record(path, TRY_SECONDS, args.record_bin)
        said = read_samples(path)
    from .models import open_detector
    from .windows import room_level, with_quiet_around

    clip = with_quiet_around(said, room_level(said), np.random.default_rng())
    detector = open_detector(args.model)
    best = max(detector.score(frame) for frame in whole_frames(clip))
    EventWriter(sys.stdout).tried(best, detector.threshold)
