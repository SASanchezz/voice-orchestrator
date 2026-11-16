import type { MacHotkey } from "./hotkey.js";
import type { TalkSwitch } from "./talk-switch.js";

/**
 * The hotkey on the shared mic: press it once to start talking and again to send. Letting go of it does nothing, so
 * you don't have to hold it. Escape discards a recording, the hotkey's or the wake word's.
 */
export class HotkeyTalk {
  constructor(
    private hotkey: MacHotkey,
    private talk: TalkSwitch,
  ) {}

  /** Fires the moment you start talking, by hotkey or gesture. */
  onPress(cb: () => void): void {
    this.talk.onPress(cb);
  }

  async start(): Promise<void> {
    await this.hotkey.start(
      () => this.toggle(),
      () => {}, // the second press sends, not letting go
      () => this.talk.cancel(),
    );
    console.log(
      `Press ${this.hotkey.keyName} to start talking and again to send; Escape discards what you're saying. Ctrl+C to quit.`,
    );
  }

  /** A press while the hotkey's recording goes sends it; any other press starts one. */
  toggle(): void {
    if (this.talk.isRecordingFor("hotkey")) this.talk.release("hotkey");
    else this.talk.press("hotkey");
  }
}
