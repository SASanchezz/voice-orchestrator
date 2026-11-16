// Where you are in the wake word review: the kind of recording on screen, and the selected one. No DOM, so the
// server (Node, for tests) and the page (browser) both compile it.

import type { WakeRecordingLabel } from "./wake-recording-views.js";

export class ReviewCursor {
  kind: WakeRecordingLabel = "wake";
  selected = 0;

  /** Starts at its first recording. */
  showKind(kind: WakeRecordingLabel): void {
    this.kind = kind;
    this.selected = 0;
  }

  otherKind(): WakeRecordingLabel {
    return this.kind === "wake" ? "other" : "wake";
  }

  /** Kept among the `count` recordings on screen. */
  select(index: number, count: number): void {
    this.selected = Math.min(Math.max(index, 0), Math.max(count - 1, 0));
  }

  isOnLast(count: number): boolean {
    return this.selected >= count - 1;
  }
}
