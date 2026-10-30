// To-do items as cards: title and project, description, where each runs, and what can be done with it. Shared by the
// whole list (todo-panel.ts) and a project's own (project-todo.ts).

import type { ProjectView, SessionView, TodoItemView, TodoListView } from "../protocol.js";
import { placeRuns } from "../todo-run-state.js";
import { act } from "./api.js";
import { button, el, formatWhen } from "./dom.js";
import { store } from "./store.js";
import { openTodoDialog } from "./todo-dialog.js";
import { runPicker } from "./todo-run-picker.js";
import { runList } from "./todo-runs.js";

/** Whether you opened the fold of done items; kept while the list is rebuilt. */
let doneShown = false;

/** What of the sessions the list shows; a cost or an activity line changing alone doesn't rebuild it. */
export function sessionsDigest(projects: ProjectView[]): string {
  return JSON.stringify(
    projects.map((project) => [project.name, project.activeSession, project.sessions.map(shownOf)]),
  );
}

function shownOf({ id, number, status, task, queued, history }: SessionView): unknown[] {
  return [id, number, status, task, queued, history.length];
}

/** The item deleted last, with an Undo, so a deletion is never silent. */
export function undoLine({ lastDeleted }: TodoListView): HTMLDivElement[] {
  if (!lastDeleted) return [];
  const undo = button("Undo", "ghost", () => void act(`/api/todo-items/${lastDeleted.id}/restore`));
  return [el("div", { class: "todo-undo" }, el("span", {}, `Deleted “${lastDeleted.title}”.`), undo)];
}

export function itemList(items: TodoItemView[]): HTMLUListElement {
  return el("ul", { class: "todo-list" }, ...items.map(itemCard));
}

export function doneFold(done: TodoItemView[]): HTMLDetailsElement[] {
  if (!done.length) return [];
  const fold = el("details", { class: "more todo-done" }, el("summary", {}, `Done (${done.length})`), itemList(done));
  fold.open = doneShown;
  fold.addEventListener("toggle", () => (doneShown = fold.open));
  return [fold];
}

function itemCard(item: TodoItemView): HTMLLIElement {
  const meta = el("div", { class: "todo-meta" }, `#${item.id} · added ${formatWhen(item.createdAt)}`);
  const description = item.description ? el("div", { class: "todo-description" }, item.description) : "";
  const runs = runList(placeRuns([item], store.state.projects));
  const card = [itemTitle(item), description, meta, ...runs, itemActions(item)];
  return el("li", { class: `todo-item${item.done ? " done" : ""}` }, ...card);
}

function itemTitle(item: TodoItemView): HTMLLabelElement {
  const tick = el("input", { type: "checkbox", title: item.done ? "Reopen" : "Tick off as done" });
  tick.checked = item.done;
  tick.addEventListener("change", () => void act(`/api/todo-items/${item.id}/done`, { done: tick.checked }));
  const project = item.project ? projectLink(item.project) : "";
  return el("label", { class: "todo-title" }, tick, el("span", {}, item.title), project);
}

/** The project's name, which shows that project while it is still open. */
export function projectLink(project: string): HTMLElement {
  const isOpen = store.state.projects.some((open) => open.name === project);
  if (!isOpen) return el("span", { class: "badge" }, project);
  const link = button(project, "badge todo-project-link", () => store.select(project));
  link.title = `Show ${project}`;
  return link;
}

function itemActions(item: TodoItemView): HTMLDivElement {
  const edit = button("Edit", "ghost", () => openTodoDialog(item));
  const remove = button("Delete", "ghost", () => void act(`/api/todo-items/${item.id}/delete`));
  return el("div", { class: "todo-actions" }, ...sendControls(item), edit, remove);
}

/** An open item goes to its project's active session in one click, or anywhere else from "Run on…". */
function sendControls(item: TodoItemView): HTMLElement[] {
  if (item.done) return [];
  return [...sendButton(item), runPicker(item)];
}

function sendButton(item: TodoItemView): HTMLButtonElement[] {
  if (!item.project) return [];
  const send = button(`Send to ${item.project}`, "ghost", () => void act(`/api/todo-items/${item.id}/send`));
  send.title = "Give this item to the project's active session as a task (title and description); it stays open here";
  return [send];
}
