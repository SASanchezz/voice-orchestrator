import { writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { wavFromPcm } from "./pcm-wav.js";
import type { Transcriber } from "./transcriber.js";

/** How often what was said so far is transcribed again while recording. */
const PREVIEW_INTERVAL_MS = 800;
/** Shorter audio is too little for whisper to hear words in. */
const MIN_PREVIEW_AUDIO_MS = 600;

/** A recording still going on: everything said so far, and how much that is. */
export interface AudioSoFar {
  audio(): Buffer;
  readonly audioBytes: number;
  readonly audioMs: number;
}

export type PreviewTranscriber = Pick<Transcriber, "previewOrNothing">;

/**
 * Your words so far while a recording goes on: everything said is transcribed again and again, one pass at a time,
 * so the words grow as you speak. Each pass writes the audio to `wav`, which the owner deletes.
 */
export class LivePreview {
  private stopping = new AbortController();
  private passes: Promise<void> = Promise.resolve();

  constructor(
    private recording: AudioSoFar,
    private wav: string,
    private transcriber: PreviewTranscriber,
  ) {}

  /** Each new version of your words so far goes to `show`, until stopped. */
  start(show: (words: string) => void): void {
    this.passes = this.previewUntilStopped(show);
  }

  /** Stops at once; resolves when a pass still running has ended, so no stale words come and the file is free. */
  stop(): Promise<void> {
    this.stopping.abort();
    return this.passes;
  }

  private async previewUntilStopped(show: (words: string) => void): Promise<void> {
    let previewedBytes = 0;
    while (!this.isStopped) {
      await this.pause();
      if (!this.hasNewAudioSince(previewedBytes)) continue;
      previewedBytes = this.recording.audioBytes;
      writeFileSync(this.wav, wavFromPcm(this.recording.audio()));
      const words = await this.transcriber.previewOrNothing(this.wav);
      if (words && !this.isStopped) show(words);
    }
  }

  /** Cut short by stopping, so the last transcription doesn't wait for it. */
  private pause(): Promise<void> {
    const pausing = delay(PREVIEW_INTERVAL_MS, undefined, { signal: this.stopping.signal });
    return pausing.catch(() => undefined); // aborted: stopped
  }

  private get isStopped(): boolean {
    return this.stopping.signal.aborted;
  }

  private hasNewAudioSince(previewedBytes: number): boolean {
    const isLongEnough = this.recording.audioMs >= MIN_PREVIEW_AUDIO_MS;
    return !this.isStopped && isLongEnough && this.recording.audioBytes > previewedBytes;
  }
}
