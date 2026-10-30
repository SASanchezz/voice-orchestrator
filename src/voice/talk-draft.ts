import { rmSync } from "node:fs";
import { GrowingWav } from "./growing-wav.js";
import { LivePreview, type PreviewTranscriber } from "./live-preview.js";

const WAV_SUFFIX = /\.wav$/;

/** Your words so far while push-to-talk records, transcribed again and again from the file sox writes. */
export class TalkDraft {
  private current?: { live: LivePreview; previewWav: string };

  constructor(
    private transcriber: PreviewTranscriber,
    private show: (words: string) => void,
  ) {}

  /** Starts showing the words of the recording sox writes to `wav`; a draft still running is ended first. */
  follow(wav: string): void {
    this.end();
    const previewWav = wav.replace(WAV_SUFFIX, "-preview.wav");
    const live = new LivePreview(new GrowingWav(wav), previewWav, this.transcriber);
    live.start((words) => this.show(words));
    this.current = { live, previewWav };
  }

  /** No more words come; the preview's file is deleted once its last pass is over. */
  end(): void {
    const current = this.current;
    this.current = undefined;
    if (current) void current.live.stop().then(() => rmSync(current.previewWav, { force: true }));
  }
}
