import type { PushToTalk } from "./push-to-talk.js";

/** What starts and ends a push-to-talk recording. */
export type TalkSource = "hotkey" | "gesture";

type Recorder = Pick<PushToTalk, "begin" | "release" | "discard" | "state">;

/**
 * The mic, shared by the hotkey and the talk gestures. While one of them records, the other can't start
 * a recording, and only the one that started it can end it.
 */
export class TalkSwitch {
  private holder?: TalkSource;
  private pressed: () => void = () => {};

  constructor(
    private ptt: Recorder,
    private stopSpeaking: () => void,
  ) {}

  /** Fires the moment you start talking, before your words are known. */
  onPress(cb: () => void): void {
    this.pressed = cb;
  }

  press(source: TalkSource): void {
    if (this.ptt.state() === "recording") return; // a recording discarded or stopped at its limit no longer counts
    this.holder = source;
    this.stopSpeaking(); // starting to talk interrupts Claude mid-sentence, as clicking a pop-up does
    this.pressed();
    this.ptt.begin();
  }

  release(source: TalkSource): void {
    if (this.holder !== source || this.ptt.state() !== "recording") return;
    this.holder = undefined;
    this.ptt.release();
  }

  /** Drops the recording while `source` still holds it; afterwards there is nothing left to drop. */
  cancel(source: TalkSource): void {
    if (this.holder === source && this.ptt.state() === "recording") this.ptt.discard();
  }
}
