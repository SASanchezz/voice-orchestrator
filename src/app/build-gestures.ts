import type { GestureSettings } from "../config/sensor-config.js";
import type { VoiceCancel } from "../orchestrator/conversation/voice-cancel.js";
import { GestureProcess } from "../sensors/gesture-process.js";
import { loadReflexTable } from "../sensors/reflex-table.js";
import { SensorRouter, type GestureActions } from "../sensors/sensor-router.js";
import { errorMessage } from "../shared/errors.js";
import type { MacVoiceParts } from "./real-adapters.js";

const LOG = "[gestures]";

/** The camera gesture sensor, with config/gestures.yaml deciding what each gesture does. */
export function buildGestures(settings: GestureSettings, actions: GestureActions): GestureProcess {
  const router = new SensorRouter(loadReflexTable(settings.mapping), actions);
  return new GestureProcess({ bin: settings.python, args: settings.args }, router);
}

/** Gestures act like the hotkey and the page's Discard button. */
export function gestureActions({ voice, talk }: MacVoiceParts, cancel: VoiceCancel): GestureActions {
  return {
    beginTalk: () => talk.press("gesture"),
    endTalk: () => talk.release("gesture"),
    discard: () => discardLatest(cancel),
    stopSpeaking: () => voice.stopSpeaking(),
  };
}

function discardLatest(cancel: VoiceCancel): void {
  try {
    console.log(`${LOG} ${cancel.discardLatest()}`);
  } catch (e) {
    console.log(`${LOG} ${errorMessage(e)}`);
  }
}
