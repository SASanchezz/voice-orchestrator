import type { MacHotkey } from "./hotkey.js";
import type { TalkSwitch } from "./talk-switch.js";

/** The hotkey on the shared mic: hold it to talk, press Escape while holding it to discard. */
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
      () => this.talk.press("hotkey"),
      () => this.talk.release("hotkey"),
      () => this.talk.cancel("hotkey"),
    );
    console.log(`Hold ${this.hotkey.keyName} to talk, and press Escape while holding it to discard. Ctrl+C to quit.`);
  }
}
