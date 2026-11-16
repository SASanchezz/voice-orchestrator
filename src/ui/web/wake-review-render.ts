// Shows the wake word review as it is now: the tab counts and the rows of the open kind; the buttons go through
// wake-review-buttons.ts.

import type { WakeRecordingLabel } from "../wake-recording-views.js";
import type { WakeReview } from "../wake-review-state.js";
import type { PlayableClip } from "./wake-clip-audio.js";
import type { ReviewButtonsView } from "./wake-review-buttons.js";
import { reviewRow, type RowActions, type RowState } from "./wake-review-rows.js";
import { KIND_TITLES, type ReviewParts } from "./wake-review-view.js";
import { drawWaveform } from "./wake-waveform.js";

const KINDS: WakeRecordingLabel[] = ["wake", "other"];

/** What a row's click and mark button do, by its place in the list. */
export type RowActionsAt = (index: number) => RowActions;

export class ReviewRenderer {
  constructor(
    private parts: ReviewParts,
    private review: WakeReview<PlayableClip>,
    private buttons: ReviewButtonsView,
  ) {}

  render(kind: WakeRecordingLabel, selected: number, actionsAt: RowActionsAt): void {
    for (const each of KINDS) this.showTab(each, each === kind);
    this.showRows(kind, selected, actionsAt);
    this.buttons.show(kind);
  }

  /** The row's playhead runs across its waveform for `seconds`. */
  showPlaying(index: number, seconds: number): void {
    const row = this.parts.list.children.item(index);
    if (!(row instanceof HTMLElement)) return;
    row.style.setProperty("--play-seconds", `${seconds}s`);
    row.classList.add("is-playing");
  }

  showStopped(index: number): void {
    this.parts.list.children.item(index)?.classList.remove("is-playing");
  }

  private showTab(kind: WakeRecordingLabel, isOpen: boolean): void {
    const tab = this.parts.tabs[kind];
    tab.textContent = `${KIND_TITLES[kind]} · ${this.review.ofLabel(kind).length}`;
    tab.setAttribute("aria-selected", String(isOpen));
  }

  private showRows(kind: WakeRecordingLabel, selected: number, actionsAt: RowActionsAt): void {
    const clips = this.review.ofLabel(kind);
    const rows = clips.map((clip, index) => reviewRow(clip, this.rowState(clip, index, selected), actionsAt(index)));
    this.parts.list.replaceChildren(...rows);
    this.keepKeysWorking();
    const loudest = Math.max(0, ...clips.map((clip) => clip.analysis.peak));
    rows.forEach((row, index) => this.drawRowWave(row, clips[index], loudest));
    rows[selected]?.scrollIntoView({ block: "nearest" });
  }

  /** A ticked checkbox was just replaced: without focus inside the window, its keys would stop working. */
  private keepKeysWorking(): void {
    if (!this.parts.dialog.contains(document.activeElement)) this.parts.list.focus({ preventScroll: true });
  }

  private rowState(clip: PlayableClip, index: number, selected: number): RowState {
    const flags = this.review.flagsOf(clip);
    return { number: index + 1, flags, isMarked: this.review.isMarked(clip), isSelected: index === selected };
  }

  private drawRowWave(row: HTMLLIElement, clip: PlayableClip, loudest: number): void {
    const canvas = row.querySelector("canvas");
    if (canvas) drawWaveform(canvas, clip.analysis.bars, loudest);
  }
}
