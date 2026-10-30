import type { Speaker } from "./repeating-speaker.js";

/**
 * Speaks with a speaker that is still being made (a voice model loading at startup). What's said meanwhile waits for
 * it, unless something newer, or your key press, cut it off first.
 */
export class LoadingSpeaker implements Speaker {
  private currentRun = 0;
  private loaded?: Speaker;

  constructor(private loading: Promise<Speaker>) {
    void loading.then((speaker) => (this.loaded = speaker));
  }

  async speak(text: string): Promise<void> {
    this.stop();
    const run = this.currentRun;
    const speaker = await this.loading;
    if (run !== this.currentRun) return;
    await speaker.speak(text);
  }

  stop(): void {
    this.currentRun++;
    this.loaded?.stop();
  }
}
