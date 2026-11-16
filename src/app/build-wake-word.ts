import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { APP_DIR, STATE_DIR } from "../config/paths.js";
import type { WakeWordSettings } from "../config/sensor-config.js";
import { TrainingCommand } from "../wake/training-command.js";
import { WakeRecordings } from "../wake/wake-recordings.js";
import { WakeWordSetting } from "../wake/wake-setting.js";
import type { WakeSwitch } from "../wake/wake-switch.js";
import { UnavailableWakeTraining, WakeTraining, type WakeTrainingControl } from "../wake/wake-training.js";
import { WakeProcess } from "../wake/wake-process.js";
import { WakeTalk } from "../wake/wake-talk.js";
import type { MacVoiceParts } from "./real-adapters.js";

/**
 * The wake word listener, talking into the same mic switch as the hotkey and gestures. It records with the same sox
 * as push-to-talk, and leaves the wake word alone while you talk or dictate. Said while a reply is spoken, it cuts the
 * reply off, as the talk key does.
 */
export function buildWakeWord(settings: WakeWordSettings, recordBin: string, parts: MacVoiceParts): WakeProcess {
  const { voice, talk, dictation } = parts;
  const isBusy = (): boolean => voice.isListening() || dictation.isRecording();
  const command = { bin: settings.python, args: [...settings.args, "--record-bin", recordBin] };
  return new WakeProcess(command, new WakeTalk(talk, isBusy));
}

/** `python -m wake`, without the listener's `run` and its options: the training commands follow. */
const TRAINING_ARGS = ["-m", "wake"];
const NOT_SET_UP = "Set up sensors/wake first, as its README says.";
/** Where sensors/wake keeps your training recordings (its wake/paths.py). */
const RECORDINGS_DIR = resolve(APP_DIR, "sensors/wake/data");

/**
 * The web UI's Train wake word dialog, recording with the same sox as push-to-talk. It pauses the listener while it
 * records or trains, and restarts it with the new model. Your recordings can be played back and deleted there.
 */
export function buildWakeTraining(
  settings: WakeWordSettings,
  recordBin: string,
  wakeWord: WakeSwitch,
): WakeTrainingControl {
  if (!isWakeWordSetUp(settings)) return new UnavailableWakeTraining(NOT_SET_UP);
  const command = new TrainingCommand({ bin: settings.python, args: TRAINING_ARGS }, recordBin);
  return new WakeTraining(command, wakeWord, new WakeRecordings(RECORDINGS_DIR));
}

/** The web UI's Wake word switch, saved in state/; on until you first switch it off. */
export function wakeWordSetting(): WakeWordSetting {
  return new WakeWordSetting(resolve(STATE_DIR, "wake-word.json"));
}

/** Its venv exists: sensors/wake was set up as its README says. */
export function isWakeWordSetUp(settings: WakeWordSettings): boolean {
  return existsSync(settings.python);
}
