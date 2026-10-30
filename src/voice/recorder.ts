import { spawn, type ChildProcess } from "node:child_process";
import type { UtteranceSlot } from "./utterance-merger.js";

const RECORDER_STOP_GRACE_MS = 2000;
const SAMPLE_FORMAT = ["-q", "-c", "1", "-r", "16000", "-b", "16"];

/** One push-to-talk recording while sox writes it. */
export interface Recording {
  /** Its place in the message being held, see UtteranceMerger. */
  slot: UtteranceSlot;
  wav: string;
  startedAt: number;
  recorder: ChildProcess;
  /** Fires if the key's release never arrives. */
  limit: NodeJS.Timeout;
}

/** sox recording 16 kHz mono 16-bit, the format whisper.cpp expects. */
export function startRecorder(recordBin: string, wav: string): ChildProcess {
  return spawn(recordBin, [...SAMPLE_FORMAT, wav], { stdio: "ignore" });
}

/** The same, as raw samples on its stdout, so they can be read while it records. */
export function startRawRecorder(recordBin: string): ChildProcess {
  return spawn(recordBin, [...SAMPLE_FORMAT, "-e", "signed-integer", "-t", "raw", "-"], {
    stdio: ["ignore", "pipe", "ignore"],
  });
}

/** Stops sox; if it ignores SIGINT (a stalled audio device), it is killed, so the mic is never left on. */
export async function stopRecorder({ recorder, limit }: Pick<Recording, "recorder" | "limit">): Promise<void> {
  clearTimeout(limit);
  await new Promise<void>((resolve) => {
    if (recorder.exitCode !== null || recorder.signalCode !== null) return resolve();
    const force = setTimeout(() => recorder.kill("SIGKILL"), RECORDER_STOP_GRACE_MS);
    recorder.once("close", () => {
      clearTimeout(force);
      resolve();
    });
    recorder.kill("SIGINT"); // sox finalizes the WAV header on SIGINT
  });
}
