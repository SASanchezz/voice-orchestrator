import { createInterface } from "node:readline";
import { toSpeech } from "./speakable.js";
import type { VoiceInputState, VoiceIO } from "./voice-io.js";

/** Keyboard-only mode for testing without audio: type instead of talking. */
export class TextVoice implements VoiceIO {
  private heard: (text: string) => void = () => {};
  private pressed: () => void = () => {};

  onUtterance(cb: (text: string) => void): void {
    this.heard = cb;
  }

  onPress(cb: () => void): void {
    this.pressed = cb;
  }

  isListening(): boolean {
    return false;
  }

  inputState(): VoiceInputState {
    return "idle";
  }

  discardInput(): void {} // a typed line is sent as soon as it is entered

  async start(): Promise<void> {
    const lines = createInterface({ input: process.stdin });
    lines.on("line", (line) => {
      if (!line.trim()) return;
      this.pressed();
      this.heard(line.trim());
    });
    console.log("Text mode: type what you would say. Ctrl+C to quit.");
  }

  async speak(text: string): Promise<void> {
    console.log(`🔊 ${toSpeech(text)}`);
  }

  stopSpeaking(): void {}
}
