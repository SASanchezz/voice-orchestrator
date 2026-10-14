// A project's sessions as tabs above the chat, like VS Code's.

import type { ProjectView, SessionView } from "../protocol.js";
import { isBusy } from "../running-tasks.js";
import { act } from "./api.js";
import { budgetBadge } from "./budget-badge.js";
import { button, el } from "./dom.js";
import { STATUS_LABELS } from "./store.js";

export function sessionTabs(project: ProjectView): HTMLDivElement[] {
  return project.sessions.map((session) => {
    const active = session.id === project.activeSession;
    const attrs = { class: `session-tab${active ? " active" : ""}`, role: "tab", "aria-selected": String(active) };
    return el("div", attrs, openButton(session, active), closeButton(session));
  });
}

function openButton(session: SessionView, active: boolean): HTMLButtonElement {
  const open = el(
    "button",
    { type: "button", class: "session-open", title: sessionTitle(session) },
    el("span", { class: `dot ${session.status}`, title: STATUS_LABELS[session.status] }),
    el("span", { class: "session-name" }, `Session ${session.number}`),
    el("span", { class: "session-title" }, sessionTitle(session)),
    budgetBadge(session),
  );
  open.addEventListener("click", () => {
    if (!active) void act(`/api/sessions/${session.id}/activate`);
  });
  return open;
}

function closeButton(session: SessionView): HTMLButtonElement {
  const close = button("×", "ghost session-close", () => closeSession(session));
  close.title = `Close session ${session.number}`;
  close.setAttribute("aria-label", `Close session ${session.number}`);
  return close;
}

/** Like a VS Code tab: named after what the session is about. */
function sessionTitle(session: SessionView): string {
  return session.task ?? session.history[0]?.task ?? "new";
}

function closeSession(session: SessionView): void {
  const warning = `Close session ${session.number}?${isBusy(session) ? " Its worker will be stopped." : ""} Its messages, queue and history are deleted.`;
  if (confirm(warning)) void act(`/api/sessions/${session.id}/close`);
}
