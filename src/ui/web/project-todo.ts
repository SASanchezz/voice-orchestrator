// A project's To-do tab: the items that belong to the project, and what runs on it now, whichever item that is. While
// open, it takes the place of the session's chat.

import type { ProjectView, TodoItemView } from "../protocol.js";
import { placeRuns, type PlacedRun } from "../todo-run-state.js";
import { button, byId, el } from "./dom.js";
import { store } from "./store.js";
import { openTodoDialogIn } from "./todo-dialog.js";
import { doneFold, itemList, sessionsDigest, undoLine } from "./todo-item-list.js";
import { activeRuns, runningNow } from "./todo-runs.js";

export function openTodoCountOf(project: string): number {
  return itemsOf(project).filter((item) => !item.done).length;
}

export function renderProjectTodo(): void {
  const project = store.selectedProject();
  const isShown = project !== undefined && store.projectTodoShown;
  byId("chat-panel", HTMLElement).classList.toggle("todo-shown", isShown);
  if (project && isShown) fillProjectTodo(byId("project-todo", HTMLElement), project);
}

function fillProjectTodo(panel: HTMLElement, project: ProjectView): void {
  const { todo, projects } = store.state;
  // rebuilt only when the list or its sessions changed, so a live update doesn't undo a hover or a scroll
  const version = `${project.name}:${JSON.stringify(todo)}:${sessionsDigest(projects)}`;
  if (panel.dataset.version === version) return;
  panel.dataset.version = version;
  const items = itemsOf(project.name);
  const open = items.filter((item) => !item.done);
  const done = items.filter((item) => item.done);
  const runsHere = runsOn(project.name, todo.items);
  const head = projectHead(project.name, open.length, activeRuns(runsHere).length);
  panel.replaceChildren(head, ...undoLine(todo), ...runningNow(runsHere), openList(open), ...doneFold(done));
}

function itemsOf(project: string): TodoItemView[] {
  return store.state.todo.items.filter((item) => item.project === project);
}

/** Runs on this project's sessions, also of items that belong to another project or to none. */
function runsOn(project: string, items: TodoItemView[]): PlacedRun[] {
  const open = items.filter((item) => !item.done);
  return placeRuns(open, store.state.projects).filter((placed) => placed.run.project === project);
}

function projectHead(project: string, openCount: number, runningCount: number): HTMLDivElement {
  const add = button("+ Add", "ghost", () => openTodoDialogIn(project));
  add.title = `Add an item to ${project}`;
  const running = runningCount ? ` · ${runningCount} running` : "";
  const count = el("span", { class: "muted" }, `${openCount} open${running}`);
  return el("div", { class: "detail-head todo-head" }, el("h2", {}, `${project} to-do`), count, add);
}

function openList(open: TodoItemView[]): HTMLElement {
  if (!open.length)
    return el("p", { class: "empty" }, "Nothing to do on this project. Add an item, or ask the assistant to.");
  return itemList(open);
}
