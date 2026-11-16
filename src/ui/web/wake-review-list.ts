// Going through the wake word review by ear: select and play, mark or keep, and switch between the two kinds.

import { ReviewCursor } from "../wake-review-cursor.js";
import type { WakeRecordingLabel } from "../wake-recording-views.js";
import type { WakeReview } from "../wake-review-state.js";
import type { PlayableClip } from "./wake-clip-audio.js";
import type { ReviewCommand } from "./wake-review-keys.js";
import type { ReviewPlayer } from "./wake-review-player.js";
import type { ReviewRenderer } from "./wake-review-render.js";
import type { RowActions } from "./wake-review-rows.js";

export class ReviewList {
  private cursor = new ReviewCursor();
  private commands: Record<ReviewCommand, () => void> = {
    next: () => this.selectAndPlay(this.cursor.selected + 1),
    previous: () => this.selectAndPlay(this.cursor.selected - 1),
    replay: () => this.selectAndPlay(this.cursor.selected),
    mark: () => this.markThenPlayNext(),
    "switch-kind": () => this.showKind(this.cursor.otherKind()),
  };

  constructor(
    private renderer: ReviewRenderer,
    private review: WakeReview<PlayableClip>,
    private player: ReviewPlayer,
  ) {}

  run(command: ReviewCommand): void {
    this.commands[command]();
  }

  showKind(kind: WakeRecordingLabel): void {
    this.cursor.showKind(kind);
    this.render();
  }

  shownKind(): WakeRecordingLabel {
    return this.cursor.kind;
  }

  render(): void {
    this.cursor.select(this.cursor.selected, this.shown().length);
    this.renderer.render(this.cursor.kind, this.cursor.selected, (index) => this.rowActions(index));
  }

  private rowActions(index: number): RowActions {
    return { select: () => this.selectAndPlay(index), toggleMark: () => this.toggleMarkAt(index) };
  }

  private selectAndPlay(index: number): void {
    this.cursor.select(index, this.shown().length);
    this.render();
    const clip = this.shown()[this.cursor.selected];
    if (clip) this.player.play(clip, this.cursor.selected);
  }

  private markThenPlayNext(): void {
    this.toggleMarkAt(this.cursor.selected);
    if (!this.cursor.isOnLast(this.shown().length)) this.selectAndPlay(this.cursor.selected + 1);
  }

  private toggleMarkAt(index: number): void {
    const clip = this.shown()[index];
    if (clip) this.review.toggleMark(clip);
    this.render();
  }

  private shown(): PlayableClip[] {
    return this.review.ofLabel(this.cursor.kind);
  }
}
