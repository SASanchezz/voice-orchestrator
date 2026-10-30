import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { Speaker } from "./repeating-speaker.js";
import { splitSentences } from "./sentences.js";
import type { SpeechSynthesizer } from "./kokoro-synthesizer.js";
import { toSpeech } from "./speakable.js";
import type { AudioPlayer } from "./wav-player.js";

/**
 * Speaks a sentence at a time: the next sentence becomes audio while the current one plays, so only the first one is
 * waited for. A new text (or your key press) cuts off the old.
 */
export class SentenceSpeaker implements Speaker {
  private currentRun = 0;
  private fileCount = 0;

  constructor(
    private synthesizer: SpeechSynthesizer,
    private player: AudioPlayer,
    private wavDir: string,
  ) {}

  async speak(text: string): Promise<void> {
    const clean = toSpeech(text);
    if (!clean) return;
    console.log(`🔊 ${clean}`);
    this.stop();
    await this.playReportingFailure(splitSentences(clean), this.currentRun);
  }

  stop(): void {
    this.currentRun++;
    this.player.stop();
  }

  private async playReportingFailure(sentences: string[], run: number): Promise<void> {
    try {
      await this.playInOrder(sentences, run);
    } catch (error) {
      console.warn(`🔇 Couldn't speak: ${String(error)}`);
    }
  }

  /** A cut-off run still waits for the sentence being rendered, to delete its file. */
  private async playInOrder(sentences: string[], run: number): Promise<void> {
    let upcoming = this.render(sentences[0]);
    for (let index = 1; index <= sentences.length; index++) {
      const wavPath = await upcoming;
      if (run !== this.currentRun) return deleteFile(wavPath);
      if (index < sentences.length) upcoming = this.render(sentences[index]);
      await this.player.play(wavPath);
      await deleteFile(wavPath);
    }
  }

  private async render(sentence: string): Promise<string> {
    const wavPath = join(this.wavDir, `sentence-${++this.fileCount}.wav`);
    await this.synthesizer.synthesize(sentence, wavPath);
    return wavPath;
  }
}

function deleteFile(path: string): Promise<void> {
  return rm(path, { force: true });
}
