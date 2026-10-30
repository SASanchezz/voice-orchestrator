import type { ChildProcess } from "node:child_process";
import { BYTES_PER_SECOND } from "./pcm-wav.js";
import { startRawRecorder, stopRecorder } from "./recorder.js";
import { MAX_RECORDING_MS } from "./recording-end.js";

const MS_PER_SECOND = 1000;

/** sox recording into memory, so what was said so far can be transcribed while it goes on. */
export class LiveRecording {
  private chunks: Buffer[] = [];
  private bytes = 0;
  private recorder: ChildProcess;
  private limit: NodeJS.Timeout;

  /** `atLimit` runs if it is never stopped, so the mic is never left on. */
  constructor(recordBin: string, atLimit: () => void) {
    this.recorder = startRawRecorder(recordBin);
    this.recorder.stdout?.on("data", (chunk: Buffer) => this.keep(chunk));
    this.limit = setTimeout(atLimit, MAX_RECORDING_MS);
  }

  /** Everything recorded so far. */
  audio(): Buffer {
    return Buffer.concat(this.chunks, this.bytes);
  }

  get audioBytes(): number {
    return this.bytes;
  }

  get audioMs(): number {
    return (this.bytes / BYTES_PER_SECOND) * MS_PER_SECOND;
  }

  stop(): Promise<void> {
    return stopRecorder({ recorder: this.recorder, limit: this.limit });
  }

  private keep(chunk: Buffer): void {
    this.chunks.push(chunk);
    this.bytes += chunk.length;
  }
}
