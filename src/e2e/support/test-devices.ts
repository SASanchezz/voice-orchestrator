import type { Screenshot, ScreenSource } from "../../screen/screen-source.js";
import type { VoiceInputState, VoiceIO } from "../../voice/voice-io.js";

const POLL_MS = 20;
const DEFAULT_WAIT_MS = 4000;

/** A fake mic and speaker: tests say things and check what was spoken. */
export class TestVoice implements VoiceIO {
  spoken: string[] = [];
  listening = false;
  private heardCallback: (text: string) => void = () => {};
  private pressCallback: () => void = () => {};

  onUtterance(cb: (text: string) => void): void {
    this.heardCallback = cb;
  }

  onPress(cb: () => void): void {
    this.pressCallback = cb;
  }

  isListening(): boolean {
    return this.listening;
  }

  inputState(): VoiceInputState {
    return this.listening ? "recording" : "idle";
  }

  async start(): Promise<void> {}

  async speak(text: string): Promise<void> {
    this.spoken.push(text);
  }

  stopSpeaking(): void {}

  say(text: string): void {
    this.pressCallback();
    this.heardCallback(text);
  }

  /** Wait until something matching `re` is spoken after index `from`. */
  async heard(re: RegExp, from = 0, ms = DEFAULT_WAIT_MS): Promise<string> {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const hit = this.spoken.slice(from).find((s) => re.test(s));
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    throw new Error(`Never heard ${re}. Spoken so far:\n  ${this.spoken.join("\n  ")}`);
  }
}

/** A fake screen that counts snapshots. */
export class TestScreen implements ScreenSource {
  captures = 0;

  capture(): void {
    this.captures++;
  }

  async latest(): Promise<Screenshot> {
    return { data: "ZmFrZQ==", mimeType: "image/jpeg" };
  }
}
