# Gestures, camera and screen history: build plan

Goal: extend the voice orchestrator with camera gestures, a camera "look" tool and screen history,
in milestones that each end in something you can run, use and commit.

Guiding rules (see the architecture notes at the end):

- Sensors are separate processes. They push only **discrete events** into the orchestrator;
  continuous data (frames, screen) stays in the sensor until a tool **pulls** it.
- Gestures first run as **reflexes** (direct actions, no model turn). Only gestures that mean
  something to the model become inputs in the `InputQueue`.
- Perception can be local (MediaPipe, whisper.cpp, a local vision model); reasoning stays on Claude.
- Node side follows CLAUDE.md as usual (file/function size limits, zod at every boundary,
  collaborators built in `main.ts`/factories, tests with temp dirs and fakes, no network).

Status legend: [ ] todo, [~] in progress, [x] done.

---

## Layout

```
sensors/gestures/            Python package (own venv, own tests)
  pyproject.toml             mediapipe, opencv-python, numpy, scikit-learn, pytest
  gestures/
    camera.py                opens the camera, yields frames
    landmarks.py             Hand (side + 21 points) and its normalized feature vector
    recognizer_canned.py     MediaPipe GestureRecognizer (built-in gestures)
    recognizer_custom.py     your trained classifier (M3)
    recognizers.py           canned | custom | both (M3)
    classifier.py            load/save/classify with the trained model (M3)
    samples.py               data/<label>.csv rows (M3)
    stabilizer.py            debounce / hold / cooldown -> start & end events
    swipes.py                wrist trail -> swipe tap events (M4)
    tracker.py               stabilizer + swipes; moving hands can't start poses (M4)
    events.py                GestureStart / GestureEnd and their JSON shape
    protocol.py              JSON-lines output and stdin commands
    pipeline.py              frame -> sightings -> events, shared by run and preview
    run.py                   headless loop
    snapshots.py             stdin snapshot commands -> JPEG of the next frame (M5)
    preview.py               window with skeleton + current label (debug)
    collect.py               record labeled samples (M3)
    train.py                 train + evaluate classifier (M3)
    __main__.py              `python -m gestures run|preview|collect|train`
  models/                    downloaded .task file + trained classifier (gitignored)
  data/                      recorded samples (gitignored)
  tests/
src/sensors/                 Node side
  sensor-event.ts            zod schema for the JSON lines
  gesture-process.ts         spawns/restarts the Python process, parses stdout
  sensor-router.ts           event -> reflex action or operator input
  reflex-table.ts            loads config/gestures.yaml
src/voice/talk-switch.ts     the mic, held by the hotkey or a gesture
src/camera/                  (M5) CameraSource + SensorCamera, like ScreenSource: capture()/latest()
config/gestures.example.yaml reflex mapping
```

Add to `.gitignore`: `sensors/gestures/.venv/`, `sensors/gestures/models/`, `__pycache__/`.

## Event protocol (Python -> Node, one JSON object per stdout line)

```json
{"type":"ready","recognizer":"canned"}
{"type":"gesture","phase":"start","name":"open_palm","hand":"right","confidence":0.93,"ts":1761400000123}
{"type":"gesture","phase":"end","name":"open_palm","hand":"right","heldMs":1840,"ts":1761400001963}
{"type":"gesture","phase":"tap","name":"swipe_left","hand":"right","confidence":0.88,"ts":...}
{"type":"error","message":"camera permission missing"}
```

- `start`/`end` give hold semantics, like key down/up. `tap` is for one-shot gestures (swipes, M4).
- `ts` is Unix time in ms. Every `start` gets an `end`, also when the sensor is stopped (Ctrl+C / SIGTERM).
- Names are snake_case. Logs go to **stderr only**; stdout is the protocol.

Commands (Node -> Python, stdin, one JSON per line; from M5):

```json
{ "cmd": "snapshot", "id": "abc", "path": "/abs/state/camera/abc.jpg" }
```

answered with `{"type":"snapshot","id":"abc","path":"...","ok":true}`.

---

## M0: Camera + hand skeleton preview [~] (code done, verify on the Mac)

Works: `python -m gestures preview` opens a window with your hand skeleton and FPS.

- [x] `sensors/gestures` package with venv (Python 3.11 or 3.12; mediapipe often lags the newest Python).
- [x] `camera.py` (OpenCV), `landmarks.py` (21 points per hand).
- [x] Handedness fix: MediaPipe's Tasks API labels hands correctly on the **raw** frame (the old docs said
      "mirrored"), so detection runs unmirrored and only the preview picture is flipped.
- [x] `preview.py` draws landmarks, handedness, FPS.
- [x] `sensors/gestures/README.md`: setup, Camera permission for the terminal app (System Settings > Privacy & Security > Camera).

Check: smooth preview (>= 20 FPS on the MacBook), skeleton follows both hands.
Commit: `gestures: camera preview with hand landmarks`

## M1: Stable gesture events on stdout (built-in recognizer, no training) [~] (code done, verify on the Mac)

Works: `python -m gestures run` prints clean start/end JSON lines as you show gestures.

- [x] `recognizer_canned.py` with MediaPipe GestureRecognizer (`gesture_recognizer.task`, downloaded on first run
      into `models/`). Built-in labels: Open_Palm, Closed_Fist, Pointing_Up, Thumb_Up, Thumb_Down, Victory,
      ILoveYou, None -> map to snake_case. It also gives the landmarks, so it replaced HandLandmarker.
- [x] Left hand: the built-in model's gestures were much weaker on the left hand. `CannedRecognizer` runs a second
      recognizer on the mirrored frame (each hand looks like the other) and gives each hand the better reading,
      matched by wrist position. ~88 FPS for both passes on the MacBook.
- [x] `stabilizer.py`: per hand, a label must hold `minHoldMs` (e.g. 250) at `minConfidence` (e.g. 0.7) to emit
      `start`; emit `end` after `releaseMs` (e.g. 200) of a different label / no hand; `cooldownMs` per name
      (default 500: a repeat already waits `minHoldMs` after an end, so a smaller cooldown does nothing).
      All four are CLI options (`--min-hold-ms` ...).
- [x] `protocol.py` writes the event lines, flushes each line.
- [x] Preview shows the stable state next to the raw label (helps tune thresholds), and prints the events too.
- [x] pytest for the stabilizer with synthetic frame sequences (flicker, short blips, hand leaving, two hands).

Check: wave the hand around normally for a minute -> no events; deliberate gestures -> exactly one start/end each.
Commit: `gestures: stable gesture events with built-in recognizer`

## M2: Gesture push-to-talk in the orchestrator [~] (code done, verify on the Mac)

Works: `npm start`, show an open palm to start talking, a closed fist to send; thumbs-down discards.
Holding a gesture for the whole message was too tiring, so talk is started and ended by two taps
(`hold: talk` still exists). Both hands work: the recognizer also runs on a mirrored frame (see M1 note below).

- [x] `config.yaml`: `sensors.gestures: { enabled, python, args, mapping: config/gestures.yaml }`, schema in
      `src/config/sensor-config.ts`, defaults off. `args` (default `[-m, gestures, run]`) replaced the planned
      `script`: the package is installed in its venv, so the interpreter plus a module is enough, and extra
      sensor options (`--min-hold-ms`, ...) go there too. Paths are relative to the app folder.
- [x] `sensor-event.ts`: zod schema for the protocol; malformed lines are logged and skipped.
- [x] `gesture-process.ts`: spawn, read lines, restart with `CrashBackoff` (reset on `ready`), stop on shutdown
      (`shutDown` in main.ts). Started once the mic is ready; not in text mode.
- [x] `config/gestures.example.yaml` (copy to the gitignored `config/gestures.yaml`):
      `yaml
  open_palm:   { tap: start_talk }   # -> voice begin
  closed_fist: { tap: end_talk }     # -> voice release (sends)
  thumb_down:  { tap: discard }      # -> like the page's Discard button (VoiceCancel.discardLatest)
  `
- [x] `sensor-router.ts` + `reflex-table.ts`: map events to actions. `src/voice/talk-switch.ts` holds the mic for
      either the hotkey or a gesture, and ignores the other until it is let go; the router allows one `talk` hold
      (one hand) at a time. A sensor that dies mid-hold ends the talk, like the hotkey helper dying.
- [x] Reuses the hotkey path's press behavior: `TalkSwitch.press` stops speech, fires `onPress` (screen capture),
      and `PushToTalk.begin` plays the start sound.
- [x] Tests: router with fake actions, talk switch with a fake recorder, process wrapper with a fake Node child.
- [ ] UI: show "gestures on/off" and the last gesture (optional; not done).

Check: full voice round-trip with no keyboard. Hotkey still works. Killing the Python process -> it restarts, app keeps running.
Commit: `sensors: gesture push-to-talk`

## M3: Your own gestures: collect data, train a classifier [~] (code done, verify on the Mac)

Works: you record a new gesture (e.g. `point_left`, `ok_sign`), train in under a minute, and it fires like the built-in ones.

- [x] `landmarks.py` features: 21x(x,y,z) relative to the wrist, scaled by palm size (wrist -> middle-finger base, 3D),
      left hand mirrored to look like the right -> 63 numbers. `FEATURE_VERSION` is saved with the model; a model
      of another version must be retrained. Finger-joint angles not added (only if accuracy needs them).
- [x] `collect.py --label ok_sign --seconds 20`: window with a 3 s countdown, then records a feature row per hand per
      frame. Appends to `data/<label>.csv` (gitignored), so sessions add up; delete the file to start over.
- [x] Always record a `none` class: random hand poses, typing, scratching, holding a cup. This is what
      prevents false positives; give it at least as many samples as the real classes combined. (`train` warns without it.)
- [x] `train.py`: scikit-learn MLP (`--model knn` for the baseline), stratified 80/20 split, prints accuracy,
      per-class precision/recall and the confusion matrix, then refits on all samples and saves `models/custom.joblib`
      with label list and feature version.
- [x] `recognizer_custom.py`; CLI option `--recognizer canned | custom | both` (custom wins at >= 0.8), passed via
      `sensors.gestures.args`. The built-in recognizer still finds the hands; the classifier labels them.
      `ready` reports the mode.
- [x] Tests: feature normalization (translation/scale/mirror invariance), train on a tiny fixture set, the custom
      recognizer's choice with a fake classifier, the recording window.

Targets: ~300-500 samples per class from 2+ sessions; validation accuracy > 95% and `none` precision high.
If a gesture keeps confusing with another, change the gesture, not the model.
Commit: `gestures: data collection and custom classifier`

## M4: Motion gestures (swipes) [~] (code done, verify on the Mac)

Works: swipe left/right fires a `tap` event; the example mapping switches macOS Spaces with them, like a three-finger
swipe on the trackpad (swipe left -> the space on the right).

- [x] Heuristic: `swipes.py` keeps each hand's wrist over a 500 ms window; an open hand (all four fingers stretched,
      from the landmarks, so it works with any `--recognizer`) in >= 60% of the frames, sideways travel >= 0.25
      image widths and at least twice the vertical travel -> `swipe_left` / `swipe_right` (named from the user's
      side), then an 800 ms cooldown that also swallows the hand swinging back. CLI: `--swipe-travel`,
      `--swipe-window-ms`, `--swipe-cooldown-ms`.
- [x] Conflict with `open_palm`: a swipe is made with an open palm, so it would also start `open_palm` (start_talk).
      `tracker.py` holds off the stabilizer's _starts_ for a hand while it moves (> 0.3 image sizes/s) and for the
      swipe cooldown; holds already started go on.
- [ ] Only if the heuristic is not good enough: small sequence model (e.g. 1D-conv/GRU over 15-20 frames of features).
- [x] New tap action `repeat_last` (`RepeatingSpeaker` around `SaySpeaker` remembers the last spoken text;
      skipped while you talk). "Dismiss notification" not added: `stop_speaking` covers the spoken part.
- [x] Tap actions `space_left` / `space_right` (`src/macos/mac-spaces.ts`): press Ctrl+Left/Right through System
      Events (`osascript`), macOS's "Move left/right a space" shortcut. Needs Accessibility permission for the terminal
      app and that shortcut left on (System Settings > Keyboard > Keyboard Shortcuts > Mission Control).
- [x] Tests: swipe detector with synthetic hand trails, open-hand check, stabilizer hold-off, tracker, tap line,
      router + reflex table for `repeat_last`, repeating speaker with a fake.

Check: swipes fire once each, the swing back doesn't fire, waving around while talking with an open palm doesn't swipe
by accident too often, and open palm / fist still start and end talk.

Commit: `gestures: swipe detection`

## M5: `look_at_camera` tool (Claude vision) [~] (code done, verify on the Mac)

Works: point at / hold up something and say "what is this?"; Claude answers from a camera frame.

- [x] `snapshots.py`: a stdin thread queues `snapshot` commands; the frame loop answers each with the next frame,
      written as a JPEG (longest edge <= 1568 px), then `{"type":"snapshot",...,"ok":true}` (or `ok:false` + message).
      Node spawns the sensor with a stdin pipe now.
- [x] `src/camera/sensor-camera.ts` (`CameraSource`, same shape as `ScreenSource`: `capture()` on talk start,
      `latest()` on demand), files in `state/camera/` with the same turn-scoped cleanup and sweep as screenshots
      (reuses `ScreenshotFolder`, `TurnShots`, `sweepLeftoverShots`). `src/sensors/sensor-snapshots.ts` matches
      answers to requests by id, fails them when the sensor stops or after 5 s. The camera works only while the
      Gestures switch is on (the sensor holds the camera); otherwise the tool says so.
- [x] Orchestrator tool `look_at_camera` next to the screen tool; prompt rule: use it when the user refers to
      something physical or is pointing. New hold action `point` (example: `pointing_up: { hold: point }`):
      pointing at talk start or while talking appends "[gesture] user is pointing" to the user's words
      (`PointingCue`). Kept as a note on the voice input instead of a new `InputSource`.
- [x] Tests: Python snapshot commands/writer, protocol lines; Node schema, process stdin round trip,
      sensor snapshots, sensor camera, tool with a fake camera, router `point`, pointing cue.

Check: with Gestures on, hold up an object, say "what is this?" -> correct answer; with Gestures off -> the assistant
says the camera works only while Gestures are on. Frames in `state/camera/` disappear after the reply.

Commit: `sensors: look_at_camera tool`

## M6: Local vision model for camera frames [~] (code done, compare on the Mac)

Works: with `camera.describer: local`, frames are described by a local vision model and only the text reaches Claude.

- [x] `llama-server` with a vision GGUF + its mmproj file (e.g. a small Qwen-VL or Gemma vision build),
      OpenAI-compatible endpoint in config: `camera: { describer: claude | local, visionServer }`
      (`src/config/camera-config.ts`, default `claude` and `http://127.0.0.1:8080`). Running it: docs/local-vision.md.
- [x] `look_at_camera` takes the user's `question` and asks a `CameraView` (`src/orchestrator/tools/camera-views.ts`):
      `PictureView` hands Claude the frame (`describer: claude`), `DescribedView` hands it the `FrameDescriber`'s text
      plus "call again with `picture: true`" for when the text isn't enough. `src/app/build-camera.ts` picks one.
      `LlamaDescriber` posts to `/v1/chat/completions` (30 s timeout, logs the latency); `src/camera/llama-chat.ts`
      builds the request (frame as a data URL, answer capped at 150 tokens) and reads the reply through zod.
- [ ] Compare quality/latency of both and note it here.

Commit: `sensors: local vision describer`

## M7: Screen history via screenpipe [ ]

Works: "what was that error I saw ten minutes ago?" gets answered from screen history.

- [ ] Install screenpipe locally, point its AI provider at nothing or a local model.
- [ ] Add its MCP server to the orchestrator's Agent SDK options (config switch), keep `MacScreen` for "now".
- [ ] Prompt rule: current screen -> screenshot tool; past -> screenpipe search.

Commit: `orchestrator: screen history via screenpipe`

## Later ideas

- "Point and ask" on screen: fingertip -> screen coordinate (calibration), crop the screenshot around it.
- Presence: no face/hand for N minutes -> pause spoken notifications.
- Gesture to approve a pending permission (thumbs-up) -- only for non-destructive ones; destructive stays voice-phrase only.

---

## Architecture notes

- **Producers vs providers.** Mic and gestures push events. Camera frames, screenshots and screen history are pulled
  by tools. Never stream frames into the queue: it floods turns and costs money.
- **Debounce in the sensor.** The orchestrator must never see jitter; thresholds live in the Python config.
- **Keep sensor events out of `AppEvents`.** Those are about workers (project/session). Sensor events go through
  `SensorRouter`; only meaningful ones become `Input`s (consider adding `"gesture"` to `InputSource`).
- **stdio JSON lines, not a message bus.** One machine, crash isolation and a different language for free; same
  pattern as the Swift helpers. Revisit only if sensors move to another device.
- **Safety unchanged.** Gestures never satisfy a destructive confirm phrase.
