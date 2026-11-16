"""Command line: `python -m wake <command>`."""

from __future__ import annotations

import argparse
import sys
from contextlib import nullcontext
from typing import BinaryIO, ContextManager

from .audio import frames, open_mic, open_wav
from .endpointer import EndpointConfig
from .listener import Listener, ListenerConfig
from .paths import DEFAULT_MODEL
from .protocol import EventWriter
from .run import listen_until_stopped
from .training_cli import add_training_commands


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        args.handler(args)
    except RuntimeError as e:
        EventWriter(sys.stdout).error(str(e))
        print(f"error: {e}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        pass
    return 0


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="wake", description="Wake word listener.")
    commands = parser.add_subparsers(dest="command", required=True)

    run = commands.add_parser("run", parents=[_listener_options()], help="wake events as JSON lines on stdout")
    run.set_defaults(handler=_run)

    setup = commands.add_parser("setup", help="download openWakeWord's base models (once)")
    setup.add_argument("--builtin", help="also a built-in wake word to try, e.g. hey_jarvis")
    setup.set_defaults(handler=_setup)

    add_training_commands(commands)
    return parser


def _listener_options() -> argparse.ArgumentParser:
    options = argparse.ArgumentParser(add_help=False)
    endpoint = EndpointConfig()
    listener = ListenerConfig()
    model_help = "wake word model: .joblib (trained here), .onnx, or a built-in name"
    options.add_argument("--model", default=DEFAULT_MODEL, help=model_help)
    threshold_help = "0..1; higher: fewer false wakes (default: the model's own, 0.8 trained here, 0.5 openWakeWord's)"
    options.add_argument("--threshold", type=float, help=threshold_help)
    options.add_argument("--end-silence-ms", type=int, default=endpoint.end_silence_ms, help="quiet this long: done")
    options.add_argument("--no-speech-ms", type=int, default=endpoint.no_speech_ms, help="nothing said: give up")
    wake_speech_help = "speech needed just before the wake word, so clicks don't wake it (0: off)"
    options.add_argument("--wake-speech-ms", type=int, default=listener.wake_speech_ms, help=wake_speech_help)
    options.add_argument("--max-ms", type=int, default=endpoint.max_ms, help="longest message after the wake word")
    options.add_argument("--record-bin", default="rec", help="sox's recorder (default rec)")
    options.add_argument("--input", help="a 16 kHz mono WAV file instead of the mic")
    return options


def _run(args: argparse.Namespace) -> None:
    from .models import SileroVoiceDetector, open_detector  # openWakeWord loads slowly; only commands that need it

    out = EventWriter(sys.stdout)
    detector = open_detector(args.model)
    threshold = detector.threshold if args.threshold is None else args.threshold
    listener = Listener(detector, SileroVoiceDetector(), _listener_config(args, threshold))
    with _audio(args) as audio:
        out.ready(detector.name)
        listen_until_stopped(listener, frames(audio), out)


def _listener_config(args: argparse.Namespace, threshold: float) -> ListenerConfig:
    endpoint = EndpointConfig(end_silence_ms=args.end_silence_ms, no_speech_ms=args.no_speech_ms, max_ms=args.max_ms)
    return ListenerConfig(threshold=threshold, wake_speech_ms=args.wake_speech_ms, endpoint=endpoint)


def _audio(args: argparse.Namespace) -> ContextManager[BinaryIO]:
    if args.input:
        return nullcontext(open_wav(args.input))
    return open_mic(args.record_bin)


def _setup(args: argparse.Namespace) -> None:
    from .models import download_base_models

    download_base_models(args.builtin)
    print("openWakeWord's models are ready.", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())
