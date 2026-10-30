import { rmSync, writeFileSync } from "node:fs";
import { LivePreview } from "./live-preview.js";
import type { LiveRecording } from "./live-recording.js";
import { wavFromPcm } from "./pcm-wav.js";
import type { Transcriber } from "./transcriber.js";

export type DictationTranscriber = Pick<Transcriber, "transcribeOrNothing" | "previewOrNothing">;

/**
 * One recording from the mic button. While it goes on, your words so far are shown as they grow (see LivePreview);
 * once stopped, the whole recording is transcribed one last time. Every pass uses the take's own WAV file, deleted at
 * the end.
 */
export class DictationTake {
  private live: LivePreview;

  constructor(
    private recording: LiveRecording,
    private wav: string,
    private transcriber: DictationTranscriber,
  ) {
    this.live = new LivePreview(recording, wav, transcriber);
  }

  /** Each new version of your words so far goes to `show`, until the take is stopped. */
  preview(show: (words: string) => void): void {
    this.live.start(show);
  }

  /** Your words, or "" for silence. */
  async finish(): Promise<string> {
    await this.stop();
    writeFileSync(this.wav, wavFromPcm(this.recording.audio()));
    const words = await this.transcriber.transcribeOrNothing(this.wav);
    rmSync(this.wav, { force: true });
    return words;
  }

  async discard(): Promise<void> {
    await this.stop();
    rmSync(this.wav, { force: true });
  }

  /** A pass still running is waited for, so no stale words are shown and the file is free. */
  private async stop(): Promise<void> {
    const previews = this.live.stop();
    await this.recording.stop();
    await previews;
  }
}
