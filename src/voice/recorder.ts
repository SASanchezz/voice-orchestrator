import { spawn, type ChildProcess } from "node:child_process";

const RECORDER_STOP_GRACE_MS = 2000;
const SAMPLE_FORMAT = ["-q", "-c", "1", "-r", "16000", "-b", "16"];

/** A sox recording going on, and the timer that stops it if nothing else does. */
export interface RunningRecorder {
  recorder: ChildProcess;
  limit: NodeJS.Timeout;
}

/** sox recording 16 kHz mono 16-bit, the format whisper.cpp expects, as raw samples on its stdout, read as it records. */
export function startRawRecorder(recordBin: string): ChildProcess {
  const args = [...SAMPLE_FORMAT, "-e", "signed-integer", "-t", "raw", "-"];
  return killedOnAppExit(spawn(recordBin, args, { stdio: ["ignore", "pipe", "ignore"] }));
}

/** A restart or crash mid-recording would otherwise leave sox orphaned, holding the mic until it is killed by hand. */
function killedOnAppExit(recorder: ChildProcess): ChildProcess {
  const kill = (): void => void recorder.kill("SIGKILL");
  process.once("exit", kill);
  recorder.once("close", () => process.off("exit", kill));
  return recorder;
}

/** Stops sox; if it ignores SIGINT (a stalled audio device), it is killed, so the mic is never left on. */
export async function stopRecorder({ recorder, limit }: RunningRecorder): Promise<void> {
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
