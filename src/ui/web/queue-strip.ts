// Above the message box: the tasks waiting in the shown session's queue. A task leaves the strip as it starts, and
// only then shows in the chat. A paused queue, after a failed or stopped task, waits for Resume or Clear.

import type { SessionView } from "../protocol.js";
import { act } from "./api.js";
import { button, byId, el } from "./dom.js";
import { QueueRow } from "./queue-row.js";
import { activeSession, store } from "./store.js";

const STRIP_ID = "queue-strip";
const PAUSED_NOTE = "The last task failed or was stopped; these tasks run only once you resume the queue.";

/** What the strip shows; it is drawn again only when this changes, so a row being edited keeps its caret. */
let shownKey = "";

export function wireQueueStrip(): void {
  const strip = el("section", { id: STRIP_ID, class: "queue-strip", "aria-label": "Queued tasks" });
  strip.hidden = true;
  byId("composer", HTMLFormElement).before(strip);
}

export function renderQueueStrip(): void {
  const session = shownSession();
  const key = JSON.stringify([session?.id, session?.queuePaused, session?.queued]);
  if (key === shownKey) return;
  shownKey = key;
  const strip = byId(STRIP_ID, HTMLElement);
  strip.hidden = !session?.queued.length;
  if (!session || strip.hidden) return;
  const wasEditing = strip.contains(document.activeElement);
  strip.replaceChildren(header(session), queueList(session));
  if (wasEditing) strip.querySelector("textarea")?.focus();
}

function shownSession(): SessionView | undefined {
  const project = store.selectedProject();
  return project ? activeSession(project) : undefined;
}

function queueList(session: SessionView): HTMLOListElement {
  const rows = session.queued.map((item, index) => new QueueRow({ sessionId: session.id, item, index }).element);
  return el("ol", { class: "queue-list" }, ...rows);
}

function header(session: SessionView): HTMLDivElement {
  const count = session.queued.length;
  if (!session.queuePaused)
    return el(
      "div",
      { class: "queue-header" },
      el("span", { class: "queue-title" }, `Queued · ${count}`),
      clearButton(session),
    );
  const title = el("span", { class: "queue-title queue-paused" }, `Paused · ${count} waiting`);
  title.title = PAUSED_NOTE;
  return el("div", { class: "queue-header" }, title, resumeButton(session), clearButton(session));
}

function resumeButton(session: SessionView): HTMLButtonElement {
  const resume = button("▶ Resume", "ghost queue-resume", () => void act(`/api/sessions/${session.id}/queue/resume`));
  resume.title = "Run the queue again, from #1";
  return resume;
}

function clearButton(session: SessionView): HTMLButtonElement {
  const clear = button("Clear", "ghost queue-clear", () => confirmClear(session));
  clear.title = "Remove every queued task; the running task goes on";
  return clear;
}

function confirmClear({ id, number, queued }: SessionView): void {
  if (confirm(`Remove all ${queued.length} queued tasks of session ${number}?`))
    void act(`/api/sessions/${id}/queue/clear`);
}
