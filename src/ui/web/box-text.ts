// The message box's text while a recording fills it: what it held when the recording started, then your words.

import { autoGrow } from "./dom.js";

export class BoxText {
  private typedBefore = "";

  constructor(private input: HTMLTextAreaElement) {}

  /** A recording starts: your words go after what the box holds now. */
  holdTyped(): void {
    this.typedBefore = this.input.value;
  }

  /** What the box held, then `words`; "" puts back just what it held. */
  showWords(words: string): void {
    this.write(BoxText.afterTyped(this.typedBefore, words));
  }

  private write(text: string): void {
    this.input.value = text;
    autoGrow(this.input);
    this.input.scrollTop = this.input.scrollHeight;
  }

  private static afterTyped(typedBefore: string, words: string): string {
    const needsSpace = words !== "" && typedBefore !== "" && !/\s$/.test(typedBefore);
    return needsSpace ? `${typedBefore} ${words}` : typedBefore + words;
  }
}
