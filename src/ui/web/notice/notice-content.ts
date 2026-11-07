// The notice on show: what ended, the summary to read, the whole closing note folded away, and a longer explanation
// once you asked for one. Everything a worker wrote goes in as text, never as HTML.

import type { NoticeView } from "../../notice-protocol.js";
import { byId, formatWhen } from "../dom.js";
import { markdownView } from "../markdown-view.js";

const OUTCOME_LABELS: Record<NoticeView["outcome"], string> = { done: "Done", failed: "Failed" };

export class NoticeContent {
  private shownKey = "";
  private shownId = "";
  private explaining = new Set<string>();

  /** Only what changed is built again, so a folded-open note stays open while the state updates. */
  render(notice: NoticeView, position: string, count: number): void {
    const key = JSON.stringify([notice, position, count, this.explaining.has(notice.id)]);
    if (key === this.shownKey) return;
    this.shownKey = key;
    const isNew = notice.id !== this.shownId;
    this.shownId = notice.id;
    renderHead(notice, position);
    byId("notice-pager", HTMLElement).hidden = count < 2;
    byId("notice-summary", HTMLElement).replaceChildren(markdownView(notice.summary));
    renderFullNote(notice, isNew);
    this.renderExplanation(notice);
  }

  toggleFullNote(): void {
    const full = byId("notice-full", HTMLDetailsElement);
    if (!full.hidden) full.open = !full.open;
  }

  /** While a notice's explanation is being written, its button says so. */
  markExplaining(id: string, isExplaining: boolean): void {
    if (isExplaining) this.explaining.add(id);
    else this.explaining.delete(id);
    this.shownKey = "";
  }

  private renderExplanation(notice: NoticeView): void {
    const section = byId("notice-explanation", HTMLElement);
    section.hidden = notice.explanation === undefined;
    section.replaceChildren(markdownView(notice.explanation ?? ""));
    const explain = byId("notice-explain", HTMLButtonElement);
    const isExplaining = this.explaining.has(notice.id);
    explain.textContent = isExplaining ? "Explaining…" : "Explain more";
    explain.disabled = isExplaining || notice.explanation !== undefined;
  }
}

function renderHead(notice: NoticeView, position: string): void {
  const badge = byId("notice-badge", HTMLElement);
  badge.textContent = OUTCOME_LABELS[notice.outcome];
  badge.className = `notice-badge ${notice.outcome}`;
  byId("notice-title", HTMLElement).textContent = notice.headline;
  byId("notice-time", HTMLElement).textContent = formatWhen(notice.endedAt);
  byId("notice-position", HTMLElement).textContent = position;
}

/** A new notice starts with its note folded. */
function renderFullNote(notice: NoticeView, isNew: boolean): void {
  const full = byId("notice-full", HTMLDetailsElement);
  full.hidden = notice.fullNote === "";
  if (isNew) full.open = false;
  byId("notice-full-body", HTMLElement).replaceChildren(markdownView(notice.fullNote));
}
