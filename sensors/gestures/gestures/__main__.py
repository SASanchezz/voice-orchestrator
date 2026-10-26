"""Command line: `python -m gestures <command>`."""

from __future__ import annotations

import argparse
import re
import sys

from .camera import CameraConfig, CameraError
from .collect import CollectSettings, run_collect
from .models import custom_model_path
from .pipeline import SensorSettings
from .preview import run_preview
from .protocol import EventWriter
from .recognizer_canned import RecognizerConfig
from .recognizers import CANNED, RECOGNIZER_MODES
from .run import run_sensor
from .samples import DATA_DIR
from .stabilizer import StabilizerConfig
from .swipes import SwipeConfig
from .train import ESTIMATORS, train

LABEL_PATTERN = re.compile(r"[a-z][a-z0-9_]*")


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        args.handler(args)
    except (CameraError, RuntimeError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        pass
    return 0


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="gestures", description="Camera gesture sensor.")
    camera = _camera_options()
    sensor = [camera, _sensor_options(), _swipe_options()]
    commands = parser.add_subparsers(dest="command", required=True)

    run = commands.add_parser("run", parents=sensor, help="gesture events as JSON lines on stdout")
    run.set_defaults(handler=_run)

    preview_help = "window with hands and gestures, plus events"
    preview = commands.add_parser("preview", parents=sensor, help=preview_help)
    preview.set_defaults(handler=_preview)

    _add_training_commands(commands, camera)
    return parser


def _add_training_commands(commands: argparse._SubParsersAction, camera: argparse.ArgumentParser) -> None:
    collect = commands.add_parser("collect", parents=[camera], help="record samples of one gesture into data/")
    collect.add_argument("--label", type=_label, required=True, help="gesture name, snake_case; `none` for no gesture")
    collect.add_argument("--seconds", type=int, default=20, help="how long to record (default 20)")
    collect.set_defaults(handler=_collect)

    training = commands.add_parser("train", help="train the custom classifier on data/ into models/custom.joblib")
    training.add_argument("--model", choices=list(ESTIMATORS), default="mlp", help="classifier type (default mlp)")
    training.set_defaults(handler=_train)


def _camera_options() -> argparse.ArgumentParser:
    options = argparse.ArgumentParser(add_help=False)
    options.add_argument("--camera", type=int, default=0, help="camera index (default 0)")
    options.add_argument("--width", type=int, default=1280)
    options.add_argument("--height", type=int, default=720)
    options.add_argument("--max-hands", type=int, default=2)
    return options


def _sensor_options() -> argparse.ArgumentParser:
    options = argparse.ArgumentParser(add_help=False)
    recognizer_help = "built-in gestures, your trained ones, or both (a confident trained one wins)"
    options.add_argument("--recognizer", choices=RECOGNIZER_MODES, default=CANNED, help=recognizer_help)
    stable = StabilizerConfig()
    options.add_argument("--min-hold-ms", type=int, default=stable.min_hold_ms, help="hold this long to start")
    options.add_argument("--min-confidence", type=float, default=stable.min_confidence, help="0..1, to start")
    options.add_argument("--release-ms", type=int, default=stable.release_ms, help="gone this long to end")
    options.add_argument("--cooldown-ms", type=int, default=stable.cooldown_ms, help="before the same gesture again")
    return options


def _swipe_options() -> argparse.ArgumentParser:
    options = argparse.ArgumentParser(add_help=False)
    swipe = SwipeConfig()
    travel_help = "image widths an open hand must move sideways for a swipe"
    options.add_argument("--swipe-travel", type=float, default=swipe.min_travel, help=travel_help)
    options.add_argument("--swipe-window-ms", type=int, default=swipe.window_ms, help="... within this long")
    cooldown_help = "before that hand swipes again"
    options.add_argument("--swipe-cooldown-ms", type=int, default=swipe.cooldown_ms, help=cooldown_help)
    return options


def _label(text: str) -> str:
    if not LABEL_PATTERN.fullmatch(text):
        raise argparse.ArgumentTypeError(f"{text!r} isn't snake_case (like ok_sign)")
    return text


def _run(args: argparse.Namespace) -> None:
    run_sensor(_sensor_settings(args), EventWriter(sys.stdout), sys.stdin)


def _preview(args: argparse.Namespace) -> None:
    run_preview(_sensor_settings(args), EventWriter(sys.stdout))


def _collect(args: argparse.Namespace) -> None:
    run_collect(CollectSettings(_camera(args), _recognizer(args), args.label, args.seconds))


def _train(args: argparse.Namespace) -> None:
    train(DATA_DIR, custom_model_path(), args.model)


def _sensor_settings(args: argparse.Namespace) -> SensorSettings:
    return SensorSettings(
        camera=_camera(args),
        recognizer=_recognizer(args),
        stabilizer=_stabilizer(args),
        swipes=_swipes(args),
        recognizer_mode=args.recognizer,
    )


def _stabilizer(args: argparse.Namespace) -> StabilizerConfig:
    return StabilizerConfig(
        min_hold_ms=args.min_hold_ms,
        min_confidence=args.min_confidence,
        release_ms=args.release_ms,
        cooldown_ms=args.cooldown_ms,
    )


def _swipes(args: argparse.Namespace) -> SwipeConfig:
    return SwipeConfig(window_ms=args.swipe_window_ms, min_travel=args.swipe_travel, cooldown_ms=args.swipe_cooldown_ms)


def _camera(args: argparse.Namespace) -> CameraConfig:
    return CameraConfig(index=args.camera, width=args.width, height=args.height)


def _recognizer(args: argparse.Namespace) -> RecognizerConfig:
    return RecognizerConfig(max_hands=args.max_hands)


if __name__ == "__main__":
    sys.exit(main())
