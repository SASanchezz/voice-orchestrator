import { resolve } from "node:path";
import { STATE_DIR } from "../config/paths.js";
import type { GestureSettings } from "../config/sensor-config.js";
import type { MacSpaces } from "../macos/mac-spaces.js";
import { GestureProcess } from "../sensors/gesture-process.js";
import { GestureSetting } from "../sensors/gesture-setting.js";
import { loadReflexTable } from "../sensors/reflex-table.js";
import type { SensorOutput } from "../sensors/sensor-lines.js";
import { SensorRouter, type GestureActions } from "../sensors/sensor-router.js";
import type { SensorSnapshots } from "../sensors/sensor-snapshots.js";
import { errorMessage } from "../shared/errors.js";
import type { OperatorParts } from "./build-operator.js";
import type { MacVoiceParts } from "./real-adapters.js";

const LOG = "[gestures]";

/**
 * The camera gesture sensor, with config/gestures.yaml deciding what each gesture does. It also takes the camera
 * snapshots for look_at_camera, since it holds the camera.
 */
export function buildGestures(
  settings: GestureSettings,
  actions: GestureActions,
  snapshots: SensorSnapshots,
): GestureProcess {
  const router = new SensorRouter(loadReflexTable(settings.mapping), actions);
  const sensor = new GestureProcess({ bin: settings.python, args: settings.args }, sensorOutput(router, snapshots));
  snapshots.attach(sensor);
  return sensor;
}

/** Gestures go to the router, snapshot answers to the snapshots waiting for them; both hear when the sensor stops. */
function sensorOutput(router: SensorRouter, snapshots: SensorSnapshots): SensorOutput {
  return {
    receive: (gesture) => router.receive(gesture),
    snapshotAnswered: (answer) => snapshots.answered(answer),
    sensorStopped: () => {
      router.sensorStopped();
      snapshots.sensorStopped();
    },
  };
}

/** The web UI's Gestures switch, saved in state/; until it is first used, `sensors.gestures.enabled` decides. */
export function gestureSetting(settings: GestureSettings): GestureSetting {
  return new GestureSetting(resolve(STATE_DIR, "gestures.json"), settings.enabled ? "on" : "off");
}

/**
 * Gestures act like the hotkey and the page's Discard button, can have the last spoken words said again,
 * switch Spaces like the trackpad, and tell the operator you are pointing.
 */
export function gestureActions(
  { voice, talk }: MacVoiceParts,
  { voiceCancel, pointing }: Pick<OperatorParts, "voiceCancel" | "pointing">,
  spaces: MacSpaces,
): GestureActions {
  return {
    beginTalk: () => talk.press("gesture"),
    endTalk: () => talk.release("gesture"),
    discard: () => discardLatest(voiceCancel),
    stopSpeaking: () => voice.stopSpeaking(),
    repeatLast: () => void voice.repeatLast(),
    spaceLeft: () => void spaces.moveLeft(),
    spaceRight: () => void spaces.moveRight(),
    pointStarted: () => pointing.pointStarted(),
    pointEnded: () => pointing.pointEnded(),
  };
}

function discardLatest(cancel: OperatorParts["voiceCancel"]): void {
  try {
    console.log(`${LOG} ${cancel.discardLatest()}`);
  } catch (e) {
    console.log(`${LOG} ${errorMessage(e)}`);
  }
}
