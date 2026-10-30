// "Run on…": sends a to-do item to any project, into one of its open sessions or a new one, grouped by project.
// A new session runs beside the project's busy ones, so several items can run on one project at once.

import type { ProjectView, SessionView, TodoItemView } from "../protocol.js";
import { act } from "./api.js";
import { el } from "./dom.js";
import { STATUS_LABELS, store } from "./store.js";

/** What picking each option does. */
const sends = new WeakMap<HTMLOptionElement, () => void>();

export function runPicker(item: TodoItemView): HTMLSelectElement {
  const prompt = el("option", { value: "" }, "Run on…");
  const groups = store.state.projects.map((project) => projectChoices(item, project));
  const select = el("select", { class: "todo-run-picker" }, prompt, ...groups);
  select.title =
    "Run this item on any project, in an open session or a new one beside it; it can run in several at once";
  select.addEventListener("change", () => sendChosen(select));
  return select;
}

function sendChosen(select: HTMLSelectElement): void {
  const [chosen] = select.selectedOptions;
  select.value = "";
  if (chosen) sends.get(chosen)?.();
}

/** The project's open sessions, then a new one; the item's own project says so. */
function projectChoices(item: TodoItemView, project: ProjectView): HTMLOptGroupElement {
  const label = project.name === item.project ? `${project.name} (its project)` : project.name;
  const sessions = project.sessions.map((session) => sessionChoice(item, project, session));
  const body = { project: project.name };
  const fresh = choice("New session", () => void act(`/api/todo-items/${item.id}/send-to-new-session`, body));
  return el("optgroup", { label }, ...sessions, fresh);
}

/** "Session 2 · running, active": a busy session queues the item behind its task. */
function sessionChoice(item: TodoItemView, project: ProjectView, session: SessionView): HTMLOptionElement {
  const active = session.id === project.activeSession ? ", active" : "";
  const label = `Session ${session.number} · ${STATUS_LABELS[session.status]}${active}`;
  const body = { session: session.id };
  return choice(label, () => void act(`/api/todo-items/${item.id}/send-to-session`, body));
}

function choice(label: string, send: () => void): HTMLOptionElement {
  const option = el("option", { value: label }, label);
  sends.set(option, send);
  return option;
}
