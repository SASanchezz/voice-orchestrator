// One row of the session list: its number and what it is about, then its state, what it runs now and its queue;
// its own stop and close at the end. Right-click opens the same menu as the session tab.

import type { ProjectView, SessionView } from "../protocol.js";
import { firstLine, sessionTopic, shortSessionTitle } from "../session-title.js";
import { budgetBadge } from "./budget-badge.js";
import { el } from "./dom.js";
import { isUnseen } from "./seen-results.js";
import { closeButton } from "./session-close.js";
import { openSessionMenu } from "./session-menu.js";
import { modelBadge } from "./session-model.js";
import { stopButtons } from "./session-stop.js";
import { showSessionChat } from "./session-switch.js";
import { STATUS_LABELS } from "./store.js";

const META_SEPARATOR = " · ";

export function sessionPickerRow(project: ProjectView, session: SessionView, onPick: () => void): HTMLDivElement {
  const pick = sessionPickerItem(project, session, onPick);
  const row = el("div", { class: "session-picker-row" }, pick, ...stopButtons(session), closeButton(session));
  row.addEventListener("contextmenu", (event) => openSessionMenu(event, project, session));
  return row;
}

function sessionPickerItem(project: ProjectView, session: SessionView, onPick: () => void): HTMLButtonElement {
  const isActive = session.id === project.activeSession;
  const attrs = { type: "button", class: itemClass(session, isActive), role: "option", title: sessionTopic(session) };
  const item = el(
    "button",
    { ...attrs, "aria-selected": String(isActive) },
    el("span", { class: `dot ${session.status}` }),
    el("span", { class: "session-picker-number" }, `#${session.number}`),
    el("span", { class: "session-picker-title" }, shortSessionTitle(session)),
    el("span", { class: "session-picker-badges" }, modelBadge(project, session), budgetBadge(session)),
    el("span", { class: "session-picker-meta" }, metaLine(session)),
  );
  item.addEventListener("click", () => {
    onPick();
    showSessionChat(project, session);
  });
  return item;
}

function itemClass(session: SessionView, isActive: boolean): string {
  const active = isActive ? " active" : "";
  const unseen = isUnseen(session) ? ` unseen ${session.status}` : "";
  return `session-picker-item${active}${unseen}`;
}

/** "running · now: Add tests · 2 queued"; a finished result you haven't opened is called out. */
function metaLine(session: SessionView): string {
  const parts = [isUnseen(session) ? `${STATUS_LABELS[session.status]}, not seen yet` : STATUS_LABELS[session.status]];
  const current = session.task === undefined ? "" : firstLine(session.task);
  if (current && current !== firstLine(sessionTopic(session))) parts.push(`now: ${current}`);
  if (session.queued.length) parts.push(`${session.queued.length} queued`);
  return parts.join(META_SEPARATOR);
}
