// One row of the wake word review: its checkbox to delete it, its number, waveform, what may be wrong with it, and
// when it was recorded.

import type { ClipFlag } from "../wake-clip-analysis.js";
import type { ReviewClip } from "../wake-review-state.js";
import { el } from "./dom.js";

const FLAG_LABELS: Record<ClipFlag, string> = { quiet: "much quieter", clipped: "distorted", "cut off": "cut off" };
const FLAG_HINTS: Record<ClipFlag, string> = {
  quiet: "Much quieter than your other takes: too far from the mic, or the word wasn't said",
  clipped: "Too loud: the mic distorted it",
  "cut off": "Still talking at the very end: the word may have been cut off",
};
const WHEN: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };

export interface RowState {
  /** Its place among its kind, from 1. */
  number: number;
  flags: ClipFlag[];
  isMarked: boolean;
  isSelected: boolean;
}

export interface RowActions {
  /** Select it and play it. */
  select: () => void;
  toggleMark: () => void;
}

/** The waveform's canvas is left empty: draw it once the row is on the page. */
export function reviewRow(clip: ReviewClip, state: RowState, actions: RowActions): HTMLLIElement {
  const wave = el("div", { class: "wake-review-wave" }, el("canvas", {}), el("div", { class: "wake-review-playhead" }));
  const row = el("li", { class: rowClass(state) }, markBox(state, actions.toggleMark));
  row.append(el("span", { class: "wake-review-number" }, `#${state.number}`), wave, flagList(state.flags));
  row.append(recordedAt(clip));
  row.addEventListener("click", actions.select);
  return row;
}

function rowClass({ isMarked, isSelected }: RowState): string {
  const looks = ["wake-review-row", isSelected ? "is-selected" : "", isMarked ? "is-marked" : ""];
  return looks.filter(Boolean).join(" ");
}

function flagList(flags: ClipFlag[]): HTMLSpanElement {
  const badges = flags.map((flag) =>
    el("span", { class: "wake-review-flag", title: FLAG_HINTS[flag] }, FLAG_LABELS[flag]),
  );
  return el("span", { class: "wake-review-flags" }, ...badges);
}

function recordedAt({ recording }: ReviewClip): HTMLSpanElement {
  const when = new Date(recording.recordedAt).toLocaleString(undefined, WHEN);
  return el("span", { class: "wake-review-when muted" }, when);
}

function markBox({ number, isMarked }: RowState, toggleMark: () => void): HTMLInputElement {
  const box = el("input", { type: "checkbox", class: "wake-review-check", title: "Select to delete (X)" });
  box.setAttribute("aria-label", `Select recording #${number} to delete`);
  box.checked = isMarked;
  box.addEventListener("click", (event) => event.stopPropagation()); // ticking it doesn't also play it
  box.addEventListener("change", toggleMark);
  return box;
}
