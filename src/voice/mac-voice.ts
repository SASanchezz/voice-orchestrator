import type { MacHotkey } from "./hotkey.js";
import type { PushToTalk } from "./push-to-talk.js";
import type { SaySpeaker } from "./say-speaker.js";
import type { VoiceInputState, VoiceIO } from "./voice-io.js";

/** macOS: push-to-talk on a hotkey, whisper.cpp for your words, `say` for the replies. */
export class MacVoice implements VoiceIO {
  private pressed: () => void = () => {};

  constructor(
    private ptt: PushToTalk,
    private speaker: SaySpeaker,
    private hotkey: MacHotkey,
  ) {}

  onUtterance(cb: (text: string) => void): void {
    this.ptt.onMessage(cb);
  }

  onPress(cb: () => void): void {
    this.pressed = cb;
  }

  isListening(): boolean {
    return this.inputState() !== "idle";
  }

  inputState(): VoiceInputState {
    return this.ptt.state();
  }

  async start(): Promise<void> {
    await this.ptt.prepare();
    await this.hotkey.start(
      () => this.keyDown(),
      () => this.ptt.release(),
    );
    console.log(`Hold ${this.hotkey.keyName} to talk. Ctrl+C to quit.`);
  }

  speak(text: string): Promise<void> {
    return this.speaker.speak(text);
  }

  stopSpeaking(): void {
    this.speaker.stop();
  }

  private keyDown(): void {
    if (this.ptt.state() === "recording") return;
    this.stopSpeaking(); // pressing the key interrupts Claude mid-sentence, as clicking a pop-up does
    this.pressed();
    this.ptt.begin();
  }
}
