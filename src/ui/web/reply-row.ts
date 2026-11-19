// One drafted reply in the Messages view's list: who, where, when, why, and the start of your draft.

import type { ReplyDraftView } from "../reply-views.js";
import { el } from "./dom.js";
import { avatar, kindPill, sourceBadge, timeLabel, urgencyPill, whereLabel } from "./reply-look.js";

export function replyRow(view: ReplyDraftView): HTMLButtonElement {
  const row = el("button", { type: "button", class: "reply-row", role: "option", "aria-selected": "false" });
  renderRow(row, view);
  return row;
}

export function renderRow(row: HTMLButtonElement, view: ReplyDraftView): void {
  const top = el(
    "span",
    { class: "reply-row-top" },
    el("strong", { class: "reply-name" }, view.from),
    timeLabel(view.createdAt),
  );
  const where = el("span", { class: "reply-row-where" }, sourceBadge(view.source), whereLabel(view));
  const tags = el("span", { class: "reply-row-tags" }, kindPill(view.kind), urgencyPill(view.urgency));
  const preview = el("span", { class: "reply-preview" }, view.text);
  const body = el("span", { class: "reply-row-body" }, top, where, tags, preview);
  row.replaceChildren(avatar(view.from, "small"), body);
  row.dataset.urgency = view.urgency;
}
