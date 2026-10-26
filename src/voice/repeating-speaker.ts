/** Says text out loud; a new text cuts off the old one. */
export interface Speaker {
  speak(text: string): Promise<void>;
  stop(): void;
}

/** Remembers what it said last, so you can have it said again when you missed it. */
export class RepeatingSpeaker implements Speaker {
  private lastText = "";

  constructor(private speaker: Speaker) {}

  speak(text: string): Promise<void> {
    if (text.trim()) this.lastText = text;
    return this.speaker.speak(text);
  }

  stop(): void {
    this.speaker.stop();
  }

  /** Before anything was said, there is nothing to repeat. */
  repeatLast(): Promise<void> {
    if (!this.lastText) return Promise.resolve();
    return this.speaker.speak(this.lastText);
  }
}
