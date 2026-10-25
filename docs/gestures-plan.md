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
    landmarks.py             Hand (side + 21 points); M3 adds the normalized feature vector
    recognizer_canned.py     MediaPipe GestureRecognizer (built-in gestures)
    recognizer_custom.py     your trained classifier (M3)
    stabilizer.py            debounce / hold / cooldown -> start & end events
    events.py                GestureStart / GestureEnd and their JSON shape
    protocol.py              JSON-lines output and stdin commands
    pipeline.py              frame -> sightings -> events, shared by run and preview
    run.py                   headless loop
    preview.py               window with skeleton + current label (debug)
    collect.py               record labeled samples (M3)
    train.py                 train + evaluate classifier (M3)
    __main__.py              `python -m gestures run|preview|collect|train`
  models/                    downloaded .task file + trained classifier (gitignored)
  data/                      recorded samples (gitignored, or commit if small)
  tests/
src/sensors/                 Node side
  sensor-event.ts            zod schema for the JSON lines
  gesture-process.ts         spawns/restarts the Python process, parses stdout
  sensor-router.ts           event -> reflex action or operator input
  reflex-table.ts            loads config/gestures.yaml
src/voice/talk-switch.ts     the mic, held by the hotkey or a gesture
  camera-source.ts           (M5) like ScreenSource: capture()/latest()
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
{"cmd":"snapshot","id":"abc","path":"/abs/state/camera/abc.jpg"}
```
answered with `{"type":"snapshot","id":"abc","path":"...","ok":true}`.

---

## M0: Camera + hand skeleton preview  [~] (code done, verify on the Mac)

Works: `python -m gestures preview` opens a window with your hand skeleton and FPS.

- [x] `sensors/gestures` package with venv (Python 3.11 or 3.12; mediapipe often lags the newest Python).
- [x] `camera.py` (OpenCV), `landmarks.py` (21 points per hand).
- [x] Handedness fix: MediaPipe's Tasks API labels hands correctly on the **raw** frame (the old docs said
      "mirrored"), so detection runs unmirrored and only the preview picture is flipped.
- [x] `preview.py` draws landmarks, handedness, FPS.
- [x] `sensors/gestures/README.md`: setup, Camera permission for the terminal app (System Settings > Privacy & Security > Camera).

Check: smooth preview (>= 20 FPS on the MacBook), skeleton follows both hands.
Commit: `gestures: camera preview with hand landmarks`

## M1: Stable gesture events on stdout (built-in recognizer, no training)  [~] (code done, verify on the Mac)

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

## M2: Gesture push-to-talk in the orchestrator  [~] (code done, verify on the Mac)

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
      ```yaml
      open_palm:   { tap: start_talk }   # -> voice begin
      closed_fist: { tap: end_talk }     # -> voice release (sends)
      thumb_down:  { tap: discard }      # -> like the page's Discard button (VoiceCancel.discardLatest)
      ```
- [x] `sensor-router.ts` + `reflex-table.ts`: map events to actions. `src/voice/talk-switch.ts` holds the mic for
      either the hotkey or a gesture, and ignores the other until it is let go; the router allows one `talk` hold
      (one hand) at a time. A sensor that dies mid-hold ends the talk, like the hotkey helper dying.
- [x] Reuses the hotkey path's press behavior: `TalkSwitch.press` stops speech, fires `onPress` (screen capture),
      and `PushToTalk.begin` plays the start sound.
- [x] Tests: router with fake actions, talk switch with a fake recorder, process wrapper with a fake Node child.
- [ ] UI: show "gestures on/off" and the last gesture (optional; not done).

Check: full voice round-trip with no keyboard. Hotkey still works. Killing the Python process -> it restarts, app keeps running.
Commit: `sensors: gesture push-to-talk`

## M3: Your own gestures: collect data, train a classifier  [ ]

Works: you record a new gesture (e.g. `point_left`, `ok_sign`), train in under a minute, and it fires like the built-in ones.

- [ ] `landmarks.py` features: 21x(x,y,z) relative to the wrist, scaled by palm size (wrist -> middle-finger base),
      left hand mirrored to look like the right -> 63 numbers. Optionally add finger-joint angles.
- [ ] `collect.py --label ok_sign --seconds 20`: records feature rows while you hold the gesture
      (vary distance, angle, lighting, both hands). Saves `data/<label>.csv`.
- [ ] Always record a `none` class: random hand poses, typing, scratching, holding a cup. This is what
      prevents false positives; give it at least as many samples as the real classes combined.
- [ ] `train.py`: scikit-learn MLP (or kNN as a baseline), stratified split, prints accuracy + confusion matrix,
      saves `models/custom.joblib` with label list and feature version.
- [ ] `recognizer_custom.py`; config `recognizer: canned | custom | both` (custom wins when confident).
- [ ] Tests: feature normalization (translation/scale/mirror invariance), train on a tiny fixture set.

Targets: ~300-500 samples per class from 2+ sessions; validation accuracy > 95% and `none` precision high.
If a gesture keeps confusing with another, change the gesture, not the model.
Commit: `gestures: data collection and custom classifier`

## M4: Motion gestures (swipes)  [ ]

Works: swipe left/right fires a `tap` event, mapped e.g. to "dismiss notification" / "repeat last reply".

- [ ] Heuristic first: wrist x-velocity over a 400-600 ms window with an open hand, minimum travel, then cooldown.
- [ ] Only if the heuristic is not good enough: small sequence model (e.g. 1D-conv/GRU over 15-20 frames of features).
- [ ] Map to actions in `gestures.yaml`; add any new orchestrator action behind a small interface + test.

Commit: `gestures: swipe detection`

## M5: `look_at_camera` tool (Claude vision)  [ ]

Works: point at / hold up something and say "what is this?"; Claude answers from a camera frame.

- [ ] Python keeps the latest frame; stdin `snapshot` command writes a JPEG (longest edge <= 1568 px).
- [ ] `camera-source.ts`, same shape as `ScreenSource` (`capture()` on talk start, `latest()` on demand),
      files in `state/camera/` with the same turn-scoped cleanup and sweep as screenshots.
- [ ] Orchestrator tool `look_at_camera` next to the screen tool; prompt rule: use it when the user refers to
      something physical or is pointing (router adds "[gesture] user is pointing" to the turn when `point` is active).
- [ ] Tests with a fake camera source.

Commit: `sensors: look_at_camera tool`

## M6: Local vision model for camera frames  [ ]

Works: with `camera.describer: local`, frames are described by a local vision model and only the text reaches Claude.

- [ ] `llama-server` with a vision GGUF + its mmproj file (e.g. a small Qwen-VL or Gemma vision build),
      OpenAI-compatible endpoint in config.
- [ ] `look_at_camera` returns the local description (plus "ask for the image if needed"), or the image when
      `describer: claude`. Compare quality/latency of both and note it here.

Commit: `sensors: local vision describer`

## M7: Screen history via screenpipe  [ ]

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
