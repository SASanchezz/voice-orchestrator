// The ↺ beside "+" on the session tabs: lists the project's closed sessions, latest first, and reopens the one you
// pick as a new active session whose worker continues its conversation. The tabs are rebuilt on every state push, so
// whether the list is open, and what it found, lives here.

import type { ProjectView } from "../protocol.js";
import type { ClosedSessionView } from "../session-protocol.js";
import { act, replyOf, urlOf } from "./api.js";
import { button, el } from "./dom.js";
import { store } from "./store.js";

const LIST_SELECTOR = ".closed-session-list, .session-reopen";

/** The open list: the project it is for and, once they arrive, its closed sessions or why they couldn't be read. */
interface OpenList {
  project: string;
  closed?: ClosedSessionView[];
  failure?: string;
}

let shown: OpenList | undefined;

export function wireClosedSessionList(): void {
  document.addEventListener("pointerdown", hideUnlessInList, { capture: true });
  document.addEventListener("keydown", hideOnEscape, { capture: true }); // before Escape discards a voice message
  window.addEventListener("blur", hideList);
}

export function reopenButton(project: ProjectView): HTMLButtonElement {
  const toggle = button("↺", "ghost session-reopen", () => void toggleList(project.name));
  toggle.title = `Reopen a closed session in ${project.name}`;
  toggle.setAttribute("aria-expanded", String(shown?.project === project.name));
  return toggle;
}

/** The list while it is open for this project, else nothing. */
export function closedSessionList(project: ProjectView): HTMLDivElement[] {
  if (shown?.project !== project.name) return [];
  const attrs = { class: "session-picker closed-session-list", role: "listbox", "aria-label": "Closed sessions" };
  return [el("div", attrs, ...listBody(shown))];
}

function listBody({ project, closed, failure }: OpenList): HTMLElement[] {
  if (failure !== undefined) return [listNote(failure)];
  if (!closed) return [listNote("Looking for closed sessions…")];
  if (!closed.length) return [listNote(`${project} has no closed sessions to reopen.`)];
  return [listNote("Reopen a closed session:"), ...closed.map((session) => closedItem(project, session))];
}

function listNote(text: string): HTMLParagraphElement {
  return el("p", { class: "closed-session-note" }, text);
}

/** Its title, and when its worker last wrote to it. */
function closedItem(project: string, session: ClosedSessionView): HTMLButtonElement {
  const item = el(
    "button",
    { type: "button", class: "closed-session-item", role: "option", title: session.title },
    el("span", { class: "session-picker-title" }, session.title),
    el("span", { class: "session-picker-meta" }, `last active ${new Date(session.lastActive).toLocaleString()}`),
  );
  item.addEventListener("click", () => void reopen(project, session));
  return item;
}

/** The reopened session's chat is shown, even from the To-do tab. */
function reopen(project: string, session: ClosedSessionView): Promise<string | undefined> {
  hideList();
  store.showProjectChat();
  return act(`${closedSessionsPath(project)}/${session.claudeSessionId}/reopen`);
}

async function toggleList(project: string): Promise<void> {
  if (shown?.project === project) return hideList();
  const list: OpenList = { project };
  shown = list;
  store.rerender();
  await fillList(list);
}

/** A list closed or replaced while it loaded stays out of sight. */
async function fillList(list: OpenList): Promise<void> {
  try {
    list.closed = await fetchClosedSessions(list.project);
  } catch (error) {
    list.failure = error instanceof Error ? error.message : String(error);
  }
  if (shown === list) store.rerender();
}

async function fetchClosedSessions(project: string): Promise<ClosedSessionView[]> {
  return await replyOf<ClosedSessionView[]>(await fetch(urlOf(closedSessionsPath(project), {})));
}

function closedSessionsPath(project: string): string {
  return `/api/projects/${encodeURIComponent(project)}/closed-sessions`;
}

function hideList(): void {
  if (!shown) return;
  shown = undefined;
  store.rerender();
}

function hideUnlessInList(event: PointerEvent): void {
  const isInList = event.target instanceof Element && event.target.closest(LIST_SELECTOR) !== null;
  if (!isInList) hideList();
}

function hideOnEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !shown) return;
  event.preventDefault();
  hideList();
}
