// A project's sessions as tabs above the chat, like VS Code's.

import type { ProjectView, SessionView } from "../protocol.js";
import { isBusy } from "../running-tasks.js";
import { act } from "./api.js";
import { budgetBadge } from "./budget-badge.js";
import { button, el } from "./dom.js";
import { isUnseen } from "./seen-results.js";
import { closeButton } from "./session-close.js";
import { STATUS_LABELS, store } from "./store.js";

export function sessionTabs(project: ProjectView): HTMLDivElement[] {
  return project.sessions.map((session) => {
    const isActiveSession = session.id === project.activeSession;
    const shown = isActiveSession && !store.projectTodoShown;
    const attrs = { class: tabClass(session, shown), role: "tab", "aria-selected": String(shown) };
    return el("div", attrs, openButton(session, isActiveSession), ...stopButtons(session), closeButton(session));
  });
}

/** A tab with finished work you haven't seen shines, green when it succeeded, red when it failed. */
function tabClass(session: SessionView, shown: boolean): string {
  const active = shown ? " active" : "";
  const unseen = isUnseen(session) ? ` unseen ${session.status}` : "";
  return `session-tab${active}${unseen}`;
}

/** The project's to-do list, as the first tab; it takes the chat's place while open. */
export function todoTab(project: ProjectView, openCount: number): HTMLDivElement {
  const shown = store.projectTodoShown;
  const attrs = { class: `session-tab todo-tab${shown ? " active" : ""}`, role: "tab", "aria-selected": String(shown) };
  const label = openCount ? `To-do (${openCount})` : "To-do";
  const open = el("button", { type: "button", class: "session-open", title: `${project.name}'s to-do list` }, label);
  open.addEventListener("click", () => store.showProjectTodo());
  return el("div", attrs, open);
}

/** A busy session can be stopped from its tab, whether or not it is the active one; only its own queue is cleared. */
function stopButtons(session: SessionView): HTMLButtonElement[] {
  if (!isBusy(session)) return [];
  const stop = button("■", "ghost session-stop", () => void act(`/api/sessions/${session.id}/stop`));
  stop.title = `Stop session ${session.number}; its queue is cleared, other sessions keep running`;
  stop.setAttribute("aria-label", `Stop session ${session.number}`);
  return [stop];
}

function openButton(session: SessionView, active: boolean): HTMLButtonElement {
  const open = el(
    "button",
    { type: "button", class: "session-open", title: openTitle(session) },
    el("span", { class: `dot ${session.status}`, title: STATUS_LABELS[session.status] }),
    el("span", { class: "session-name" }, `Session ${session.number}`),
    el("span", { class: "session-title" }, sessionTitle(session)),
    budgetBadge(session),
  );
  open.addEventListener("click", () => {
    store.showProjectChat();
    if (!active) void act(`/api/sessions/${session.id}/activate`);
  });
  return open;
}

function openTitle(session: SessionView): string {
  return isUnseen(session) ? `Finished; open it to see the result. ${sessionTitle(session)}` : sessionTitle(session);
}

/** Like a VS Code tab: named after what the session is about. */
function sessionTitle(session: SessionView): string {
  return session.task ?? session.history[0]?.task ?? "new";
}
