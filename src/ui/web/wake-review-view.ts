// The wake word review's window: tabs for the two kinds of recording, the list, and the buttons under it. Built
// here once; what it shows is filled in by wake-review-render.ts.

import type { WakeRecordingLabel } from "../wake-recording-views.js";
import { el } from "./dom.js";
import { KEYS_HINT } from "./wake-review-keys.js";

export const KIND_TITLES: Record<WakeRecordingLabel, string> = { wake: "“Hey Oracle”", other: "Other talk" };
const INTRO =
  "Listen through your takes and tick the poor ones; flagged takes are worth a listen first. " +
  "Nothing is deleted until you press Delete, and the model changes only when you train again.";

export interface ReviewParts {
  dialog: HTMLDialogElement;
  tabs: Record<WakeRecordingLabel, HTMLButtonElement>;
  list: HTMLOListElement;
  /** Ticks or clears every recording on the open tab. */
  selectAll: HTMLInputElement;
  suggest: HTMLButtonElement;
  remove: HTMLButtonElement;
  status: HTMLElement;
}

export interface ReviewButtons {
  showKind: (kind: WakeRecordingLabel) => void;
  markSuggested: () => void;
  toggleAll: () => void;
  deleteMarked: () => void;
}

export type StatusLook = "is-working" | "is-refused" | "";

/** On the page, but not open yet; its buttons do nothing until `wireReviewButtons`. */
export function buildReviewDialog(): ReviewParts {
  const parts: ReviewParts = {
    dialog: el("dialog", { class: "confirm-dialog wake-review-dialog", "aria-label": "Review your recordings" }),
    tabs: { wake: kindTab(), other: kindTab() },
    list: el("ol", { class: "wake-review-list", tabindex: "0", "aria-label": "Recordings" }),
    selectAll: el("input", { type: "checkbox", class: "wake-review-check" }),
    suggest: plainButton("Select flagged", "ghost"),
    remove: plainButton("Delete selected", "danger"),
    status: el("span", { class: "wake-review-status", role: "status", "aria-live": "polite" }),
  };
  parts.dialog.append(header(parts), toolbar(parts), parts.list, footer(parts));
  document.body.append(parts.dialog);
  return parts;
}

export function wireReviewButtons(parts: ReviewParts, actions: ReviewButtons): void {
  parts.tabs.wake.addEventListener("click", () => actions.showKind("wake"));
  parts.tabs.other.addEventListener("click", () => actions.showKind("other"));
  parts.suggest.addEventListener("click", actions.markSuggested);
  parts.selectAll.addEventListener("change", actions.toggleAll);
  parts.remove.addEventListener("click", actions.deleteMarked);
}

function kindTab(): HTMLButtonElement {
  return el("button", { type: "button", class: "wake-review-tab", role: "tab" });
}

function plainButton(label: string, variant: string): HTMLButtonElement {
  return el("button", { type: "button", class: variant }, label);
}

function header({ tabs }: ReviewParts): HTMLElement {
  const tabList = el("div", { class: "wake-review-tabs", role: "tablist" }, tabs.wake, tabs.other);
  return el("header", { class: "wake-review-head" }, el("h2", {}, "Review your recordings"), tabList);
}

function toolbar({ selectAll, suggest }: ReviewParts): HTMLElement {
  const intro = el("p", { class: "muted" }, INTRO);
  const allLabel = el("label", { class: "wake-review-select-all" }, selectAll, "Select all");
  const keys = el("span", { class: "wake-review-keys muted" }, KEYS_HINT);
  const tools = el("div", { class: "wake-review-row-tools" }, allLabel, suggest, keys);
  return el("div", { class: "wake-review-tools" }, intro, tools);
}

function footer({ status, remove }: ReviewParts): HTMLElement {
  const close = el("button", { type: "button", class: "intent-dismiss", title: "Close (Esc)" }, "Close");
  close.addEventListener("click", () => close.closest("dialog")?.close());
  return el("footer", { class: "wake-review-foot" }, status, remove, close);
}

export function showReviewStatus({ status }: ReviewParts, text: string, look: StatusLook): void {
  status.textContent = text;
  status.className = `wake-review-status ${look}`.trim();
}
