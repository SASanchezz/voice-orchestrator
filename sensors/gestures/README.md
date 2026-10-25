# gestures

Camera gesture sensor for the voice orchestrator. Build plan: [docs/gestures-plan.md](../../docs/gestures-plan.md).

Status: **M1**, stable gesture events (MediaPipe's built-in gestures) as JSON lines on stdout.

## Setup (macOS)

Python 3.11 or newer (MediaPipe sometimes lags the newest Python release; if `pip install` finds no
`mediapipe` wheel, use an older Python, e.g. `brew install python@3.12`).

```bash
cd sensors/gestures
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Allow **Camera** for your terminal app (Terminal, iTerm, the VS Code terminal) in
**System Settings → Privacy & Security → Camera**, then fully quit and reopen the terminal.
macOS usually asks the first time you run the preview.

## Run

```bash
python -m gestures run                  # gesture events on stdout, nothing else; Ctrl+C to stop
python -m gestures preview              # window + the same events; q or Esc to quit
python -m gestures preview --camera 1   # another camera (e.g. an iPhone via Continuity Camera)
python -m gestures preview --max-hands 1 --width 960 --height 540
python -m gestures preview --min-hold-ms 400 --min-confidence 0.8   # tune the stabilizer
```

Built-in gestures: `open_palm`, `closed_fist`, `pointing_up`, `thumb_up`, `thumb_down`, `victory`, `i_love_you`.

Stabilizer options (both commands):

| Option | Default | Meaning |
| --- | --- | --- |
| `--min-hold-ms` | 250 | a gesture must be seen this long to `start` |
| `--min-confidence` | 0.7 | ... at this confidence or more |
| `--release-ms` | 200 | `end` once the hand shows something else, or is gone, this long |
| `--cooldown-ms` | 500 | after an `end`, the same hand can't start the same gesture for this long |

Output, one JSON object per line (logs go to stderr):

```json
{"type":"ready","recognizer":"canned"}
{"type":"gesture","phase":"start","name":"open_palm","hand":"right","confidence":0.934,"ts":1761400000123}
{"type":"gesture","phase":"end","name":"open_palm","hand":"right","heldMs":1840,"ts":1761400002163}
{"type":"error","message":"Camera 0 gives no frames. ..."}
```

`ts` is Unix time in ms. On Ctrl+C or SIGTERM, every held gesture still gets its `end`.

The first run downloads `gesture_recognizer.task` (~8 MB) into `models/` (gitignored). If that fails
(behind a proxy, or Python's SSL certificates aren't installed), download it by hand:

```bash
mkdir -p models && curl -L -o models/gesture_recognizer.task \
  https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task
```

## Test

```bash
pytest
```

Tests need no camera. The real-model test is skipped until the model has been downloaded.

## How it works

| File | Job |
| --- | --- |
| `camera.py` | OpenCV capture (AVFoundation on macOS), raw frames (not mirrored) |
| `recognizer_canned.py` | MediaPipe GestureRecognizer in VIDEO mode → `Sighting(hand, gesture, confidence)` per hand |
| `landmarks.py` | `Hand(side, score, 21 points)` |
| `stabilizer.py` | per-hand hold / release / cooldown → `start` and `end` events |
| `events.py`, `protocol.py` | the events and their JSON lines on stdout |
| `pipeline.py` | frame → sightings → events; shared by `run` and `preview` |
| `run.py` | the headless loop |
| `preview.py`, `drawing.py`, `fps.py` | the window: skeletons, raw labels, stable holds, FPS |
| `models.py` | downloads model files once |

Points are normalized: `x`, `y` in 0..1 of the image, `z` is depth relative to the wrist (smaller = closer).
Detection runs on the raw frame, because that's where MediaPipe's `Right` is your right hand
(on a mirrored frame the labels come out swapped). The preview mirrors only the picture you see.

In the preview, each hand's label shows the raw per-frame gesture and its confidence; the top line
shows what the stabilizer considers held. If a held gesture flickers or fires by accident, raise
`--min-hold-ms` or `--min-confidence`; if ends come too early, raise `--release-ms`.
