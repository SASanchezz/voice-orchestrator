"""Command line: `python -m gestures <command>`."""

from __future__ import annotations

import argparse
import sys

from .camera import CameraConfig, CameraError
from .pipeline import SensorSettings
from .preview import run_preview
from .protocol import EventWriter
from .recognizer_canned import RecognizerConfig
from .run import run_sensor
from .stabilizer import StabilizerConfig


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        args.handler(_settings(args), EventWriter(sys.stdout))
    except (CameraError, RuntimeError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        pass
    return 0


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="gestures", description="Camera gesture sensor.")
    options = _sensor_options()
    commands = parser.add_subparsers(dest="command", required=True)
    
    run = commands.add_parser("run", parents=[options], help="gesture events as JSON lines on stdout")
    run.set_defaults(handler=run_sensor)

    preview = commands.add_parser("preview", parents=[options], help="window with hands and gestures, plus events")
    preview.set_defaults(handler=run_preview)

    return parser


def _sensor_options() -> argparse.ArgumentParser:
    options = argparse.ArgumentParser(add_help=False)
    options.add_argument("--camera", type=int, default=0, help="camera index (default 0)")
    options.add_argument("--width", type=int, default=1280)
    options.add_argument("--height", type=int, default=720)
    options.add_argument("--max-hands", type=int, default=2)
    stable = StabilizerConfig()
    options.add_argument("--min-hold-ms", type=int, default=stable.min_hold_ms, help="hold this long to start")
    options.add_argument("--min-confidence", type=float, default=stable.min_confidence, help="0..1, to start")
    options.add_argument("--release-ms", type=int, default=stable.release_ms, help="gone this long to end")
    options.add_argument("--cooldown-ms", type=int, default=stable.cooldown_ms, help="before the same gesture again")
    return options


def _settings(args: argparse.Namespace) -> SensorSettings:
    return SensorSettings(
        camera=CameraConfig(index=args.camera, width=args.width, height=args.height),
        recognizer=RecognizerConfig(max_hands=args.max_hands),
        stabilizer=StabilizerConfig(
            min_hold_ms=args.min_hold_ms,
            min_confidence=args.min_confidence,
            release_ms=args.release_ms,
            cooldown_ms=args.cooldown_ms,
        ),
    )


if __name__ == "__main__":
    sys.exit(main())
