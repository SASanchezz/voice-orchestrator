import type { PushToTalk } from "./push-to-talk.js";

/** What starts and ends a push-to-talk recording. */
export type TalkSource = "hotkey" | "gesture" | "wake";

type Recorder = Pick<PushToTalk, "begin" | "release" | "discard" | "state">;

/**
 * The mic, shared by the hotkey, the talk gestures and the wake word. While one of them records, the others can't
 * start a recording, and only the one that started it can end it.
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
    if (!this.isRecordingFor(source)) return;
    this.holder = undefined;
    this.ptt.release();
  }

  /** Escape: drops the recording, whatever started it; with none going, there is nothing to drop. */
  cancel(): void {
    if (this.ptt.state() !== "recording") return;
    this.holder = undefined;
    this.ptt.discard();
  }

  /** `source` started the recording going now; one discarded or stopped at its limit no longer counts. */
  isRecordingFor(source: TalkSource): boolean {
    return this.holder === source && this.ptt.state() === "recording";
  }
}
