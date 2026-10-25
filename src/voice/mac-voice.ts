import type { HotkeyTalk } from "./hotkey-talk.js";
import type { PushToTalk } from "./push-to-talk.js";
import type { SaySpeaker } from "./say-speaker.js";
import type { VoiceInputState, VoiceIO } from "./voice-io.js";

/** macOS: push-to-talk on a hotkey, whisper.cpp for your words, `say` for the replies. */
export class MacVoice implements VoiceIO {
  constructor(
    private ptt: PushToTalk,
    private speaker: SaySpeaker,
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
}
