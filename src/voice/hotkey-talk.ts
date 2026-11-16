import type { MacHotkey } from "./hotkey.js";
import type { SharedMic } from "./shared-mic.js";

type Mic = Pick<SharedMic, "start" | "send" | "cancel" | "state">;

/**
 * The hotkey on the shared mic: press it once to start talking and again to send, whatever started the recording.
 * Letting go of it does nothing, so you don't have to hold it. Escape discards a recording, whatever started it.
 */
export class HotkeyTalk {
  constructor(
    private hotkey: MacHotkey,
    private mic: Mic,
  ) {}

  async start(): Promise<void> {
    await this.hotkey.start(
      () => this.toggle(),
      () => {}, // the second press sends, not letting go
      () => void this.mic.cancel(),
    );
    console.log(
      `Press ${this.hotkey.keyName} to start talking and again to send; Escape discards what you're saying. Ctrl+C to quit.`,
    );
  }

  /** A press while any recording goes sends it, the mic button's and the wake word's too; any other press starts one. */
  toggle(): void {
    if (this.mic.state() === "recording") void this.mic.send();
    else this.mic.start("hotkey");
  }
}
