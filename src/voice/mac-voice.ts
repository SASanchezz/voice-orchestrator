import type { HotkeyTalk } from "./hotkey-talk.js";
import type { PushToTalk } from "./push-to-talk.js";
import type { RepeatingSpeaker } from "./repeating-speaker.js";
import type { VoiceInputState, VoiceIO } from "./voice-io.js";

/** macOS: push-to-talk on a hotkey, whisper.cpp for your words, `say` for the replies. */
export class MacVoice implements VoiceIO {
  constructor(
    private ptt: PushToTalk,
    private speaker: RepeatingSpeaker,
    private hotkey: HotkeyTalk,
  ) {}

  onUtterance(cb: (text: string) => void): void {
    this.ptt.onMessage(cb);
  }

  onPress(cb: () => void): void {
    this.hotkey.onPress(cb);
  }

  isListening(): boolean {
    return this.inputState() !== "idle";
  }

  inputState(): VoiceInputState {
    return this.ptt.state();
  }

  discardInput(): void {
    this.ptt.discard();
  }

  async start(): Promise<void> {
    await this.ptt.prepare();
    await this.hotkey.start();
  }

  speak(text: string): Promise<void> {
    return this.speaker.speak(text);
  }

  stopSpeaking(): void {
    this.speaker.stop();
  }

  /** Not while you talk: the mic would hear it. */
  repeatLast(): Promise<void> {
    if (this.isListening()) return Promise.resolve();
    return this.speaker.repeatLast();
  }
}
