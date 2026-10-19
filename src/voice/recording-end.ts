import { rmSync } from "node:fs";
import { stopRecorder, type Recording } from "./recorder.js";
import { END_SOUND, playSound } from "./sounds.js";
import type { Transcriber } from "./transcriber.js";
import type { UtteranceMerger } from "./utterance-merger.js";

const SECOND_MS = 1000;
/** Longer than anyone holds push-to-talk; past this the key's release was probably missed. */
export const MAX_RECORDING_MS = 600_000; // ten minutes
/** Shorter presses are accidental taps; nothing is transcribed. */
const MIN_RECORDING_MS = 400;

/** The key was released: stop recording, then hand the words (if any) to the message being held. */
export async function transcribeRecording(
  recording: Recording,
  transcriber: Transcriber,
  merger: UtteranceMerger,
): Promise<void> {
  const held = Date.now() - recording.startedAt;
  await stopRecorder(recording);
  if (held < MIN_RECORDING_MS) return complete(recording, "", merger); // accidental tap
  playSound(END_SOUND);
  complete(recording, await transcriber.transcribeOrNothing(recording.wav), merger);
}

/** Safety net when the key's release never arrives: the mic goes off and what was said is still sent. */
export function finishAtLimit(recording: Recording, transcriber: Transcriber, merger: UtteranceMerger): Promise<void> {
  console.error(
    `[voice] still recording after ${MAX_RECORDING_MS / SECOND_MS}s; stopped, and what was said is sent as it is.`,
  );
  return transcribeRecording(recording, transcriber, merger);
}

/** You discarded it: the mic goes off and the file is deleted unheard. */
export async function discardRecording(recording: Recording): Promise<void> {
  await stopRecorder(recording);
  rmSync(recording.wav, { force: true });
}

function complete(recording: Recording, transcript: string, merger: UtteranceMerger): void {
  rmSync(recording.wav, { force: true });
  merger.finish(recording.slot, transcript);
}
