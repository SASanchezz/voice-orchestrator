import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { STATE_DIR } from "../config/paths.js";

/** state/ptt-<n>.wav, a new one per recording: the previous one may still be transcribing. */
export class RecordingFiles {
  private count = 0;

  /** The next file, emptied. */
  next(): string {
    const wav = resolve(STATE_DIR, `ptt-${++this.count}.wav`);
    rmSync(wav, { force: true });
    return wav;
  }
}
