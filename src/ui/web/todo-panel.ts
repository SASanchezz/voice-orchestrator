// The right panel while the assistant's chat is selected: your to-do list. What runs now comes first, then the open
// items grouped by project, each with where it runs; the done ones are folded.

import type { TodoItemView } from "../protocol.js";
import { groupByProject, NO_PROJECT, type TodoGroup } from "../todo-groups.js";
import { placeRuns } from "../todo-run-state.js";
import { button, el } from "./dom.js";
import { store } from "./store.js";
import { openTodoDialog } from "./todo-dialog.js";
import { doneFold, itemList, projectLink, sessionsDigest, undoLine } from "./todo-item-list.js";
import { activeRuns, runningNow } from "./todo-runs.js";

export function renderTodoPanel(panel: HTMLElement): void {
  const { todo, projects } = store.state;
  // rebuilt only when the list or its sessions changed, so a live update doesn't undo a hover or a scroll
  const version = `todo:${JSON.stringify(todo)}:${sessionsDigest(projects)}`;
  if (panel.dataset.version === version) return;
  panel.dataset.version = version;
  const open = todo.items.filter((item) => !item.done);
  const done = todo.items.filter((item) => item.done);
  const openRuns = placeRuns(open, projects);
  const head = todoHead(open.length, activeRuns(openRuns).length);
  panel.replaceChildren(head, ...undoLine(todo), ...runningNow(openRuns), groupedList(open), ...doneFold(done));
}

function todoHead(openCount: number, runningCount: number): HTMLDivElement {
  const add = button("+ Add", "ghost", () => openTodoDialog());
  add.title = "Add an item; you can also say “add a new task …”";
  const running = runningCount ? ` · ${runningCount} running` : "";
  const count = el("span", { class: "muted" }, `${openCount} open${running}`);
  return el("div", { class: "detail-head todo-head" }, el("h2", {}, "To-do"), count, add);
}

function groupedList(items: TodoItemView[]): HTMLElement {
  if (!items.length) return emptyList();
  const listed = store.state.projects.map((project) => project.name);
  return el("div", { class: "todo-groups" }, ...groupByProject(items, listed).map(groupSection));
}

function emptyList(): HTMLParagraphElement {
  return el("p", { class: "empty" }, "Nothing to do. Add an item, or ask the assistant to.");
}

function groupSection(group: TodoGroup): HTMLElement {
  const count = el("span", { class: "muted" }, String(group.items.length));
  const head = el("h3", { class: "todo-section-head" }, groupName(group.project), count);
  return el("section", { class: "todo-group" }, head, itemList(group.items));
}

function groupName(project: string): HTMLElement | string {
  return project === NO_PROJECT ? "No project" : projectLink(project);
}
