// The strip above the chat: the project's to-do list, then one tab for the active session; clicking that tab opens
// the list of every session (session-picker.ts).

import type { ProjectView, SessionView } from "../protocol.js";
import { sessionTopic, shortSessionTitle } from "../session-title.js";
import { budgetBadge } from "./budget-badge.js";
import { el } from "./dom.js";
import { isUnseen } from "./seen-results.js";
import { closeButton } from "./session-close.js";
import { openSessionMenu } from "./session-menu.js";
import { modelBadge } from "./session-model.js";
import { isSessionPickerOpen, toggleSessionPicker } from "./session-picker.js";
import { stopButtons } from "./session-stop.js";
import { STATUS_LABELS, store } from "./store.js";

/** The active session, with its model, context, stop and close; right-click still opens its menu. */
export function currentSessionTab(project: ProjectView, session: SessionView): HTMLDivElement {
  const shown = !store.projectTodoShown;
  const attrs = { class: `session-tab current-session${shown ? " active" : ""}`, role: "tab" };
  const tab = el("div", { ...attrs, "aria-selected": String(shown) });
  tab.append(pickerToggle(project, session), ...stopButtons(session), closeButton(session));
  tab.addEventListener("contextmenu", (event) => openSessionMenu(event, project, session));
  return tab;
}

/** The project's to-do list, as the first tab; it takes the chat's place while open. */
export function todoTab(project: ProjectView, openCount: number): HTMLDivElement {
  const shown = store.projectTodoShown;
  const attrs = { class: `session-tab todo-tab${shown ? " active" : ""}`, role: "tab", "aria-selected": String(shown) };
  const title = `${project.name}'s to-do list`;
  const open = el("button", { type: "button", class: "session-open", title }, todoLabel(), ...todoCount(openCount));
  open.addEventListener("click", () => store.showProjectTodo());
  return el("div", attrs, open);
}

/** The word gives way to an icon when the panel is narrow (todo.css). */
function todoLabel(): HTMLSpanElement {
  return el("span", { class: "todo-label" }, "To-do");
}

/** How many items are still open, as a pill; none once the list is done. */
function todoCount(openCount: number): HTMLSpanElement[] {
  return openCount ? [el("span", { class: "todo-count" }, String(openCount))] : [];
}

function pickerToggle(project: ProjectView, session: SessionView): HTMLButtonElement {
  const toggle = el(
    "button",
    { type: "button", class: "session-open session-picker-toggle", title: toggleTitle(session) },
    el("span", { class: `dot ${session.status}`, title: STATUS_LABELS[session.status] }),
    el("span", { class: "session-name" }, String(session.number)),
    el("span", { class: "session-title" }, shortSessionTitle(session)),
    modelBadge(project, session),
    budgetBadge(session),
    sessionCount(project, session),
  );
  toggle.setAttribute("aria-haspopup", "listbox");
  toggle.setAttribute("aria-expanded", String(isSessionPickerOpen()));
  toggle.addEventListener("click", () => {
    store.showProjectChat();
    toggleSessionPicker();
  });
  return toggle;
}

function toggleTitle(session: SessionView): string {
  return `Session ${session.number}: ${sessionTopic(session)}\nClick to see and switch between all sessions.`;
}

/** "5 ▾", shining while another session has a result you haven't opened. */
function sessionCount(project: ProjectView, session: SessionView): HTMLSpanElement {
  const unseenOthers = project.sessions.filter((other) => other.id !== session.id && isUnseen(other)).length;
  const unseenClass = unseenOthers ? " unseen" : "";
  const title = unseenOthers ? `${unseenOthers} other session(s) finished; open the list to see them` : "";
  return el("span", { class: `session-count${unseenClass}`, title }, `${project.sessions.length} ▾`);
}
