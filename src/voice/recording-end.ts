import { rmSync } from "node:fs";
import { stopRecorder, type Recording } from "./recorder.js";
import { END_SOUND, FAILURE_SOUND, playSound } from "./sounds.js";
import type { Transcriber } from "./transcriber.js";
import type { UtteranceMerger } from "./utterance-merger.js";

const SECOND_MS = 1000;
/** Longer than anyone holds push-to-talk; past this the key's release was missed. */
export const MAX_RECORDING_MS = 90_000;
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

/** Safety net when the key's release never arrives: the mic goes off and nothing is sent. */
export function abandonRecording(recording: Recording, merger: UtteranceMerger): void {
  console.error(
    `[voice] still recording after ${MAX_RECORDING_MS / SECOND_MS}s; the key release was probably missed. Stopped, nothing sent.`,
  );
  playSound(FAILURE_SOUND);
  void stopRecorder(recording).then(() => complete(recording, "", merger));
}

function complete(recording: Recording, transcript: string, merger: UtteranceMerger): void {
  rmSync(recording.wav, { force: true });
  merger.finish(recording.slot, transcript);
}
