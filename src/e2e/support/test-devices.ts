import type { CameraSource } from "../../camera/camera-source.js";
import type { Screenshot, ScreenSource } from "../../screen/screen-source.js";
import type { VoiceInputState, VoiceIO } from "../../voice/voice-io.js";

const POLL_MS = 20;
const DEFAULT_WAIT_MS = 4000;

/** A fake mic and speaker: tests say things and check what was spoken. */
export class TestVoice implements VoiceIO {
  spoken: string[] = [];
  /** How often speech was cut off, by the talk key or a pop-up's click. */
  stops = 0;
  listening = false;
  private heardCallback: (text: string) => void = () => {};
  private pressCallback: () => void = () => {};

  onUtterance(cb: (text: string) => void): void {
    this.heardCallback = cb;
  }

  onDraft(): void {}

  onPress(cb: () => void): void {
    this.pressCallback = cb;
  }

  isListening(): boolean {
    return this.listening;
  }

  inputState(): VoiceInputState {
    return this.listening ? "recording" : "idle";
  }

  discardInput(): void {
    this.listening = false;
  }

  async start(): Promise<void> {}

  async speak(text: string): Promise<void> {
    this.spoken.push(text);
  }

  stopSpeaking(): void {
    this.stops++;
  }

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

/** A fake screen that counts snapshots and remembers when ended turns released them. */
export class TestScreen implements ScreenSource {
  captures = 0;
  releases: number[] = [];

  capture(): void {
    this.captures++;
  }

  async latest(): Promise<Screenshot> {
    return { data: "ZmFrZQ==", mimeType: "image/jpeg" };
  }

  releaseShotsBefore(time: number): void {
    this.releases.push(time);
  }
}

/** A fake camera; like the fake screen, it counts frames and remembers their releases. */
export class TestCamera extends TestScreen implements CameraSource {}
