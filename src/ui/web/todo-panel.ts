// The right panel while the assistant's chat is selected: your to-do list, open items first, the done ones folded.

import type { TodoItemView, TodoListView } from "../protocol.js";
import { act } from "./api.js";
import { button, el, formatWhen } from "./dom.js";
import { store } from "./store.js";
import { openTodoDialog } from "./todo-dialog.js";

/** Whether you opened the fold of done items; kept while the list is rebuilt. */
let doneShown = false;

export function renderTodoPanel(panel: HTMLElement): void {
  const { todo } = store.state;
  // rebuilt only when the list changed, so a live update doesn't undo a hover or a scroll
  const version = `todo:${JSON.stringify(todo)}`;
  if (panel.dataset.version === version) return;
  panel.dataset.version = version;
  const open = todo.items.filter((item) => !item.done);
  const done = todo.items.filter((item) => item.done);
  panel.replaceChildren(todoHead(open.length), ...undoLine(todo), itemList(open), ...doneFold(done));
}

function todoHead(openCount: number): HTMLDivElement {
  const add = button("+ Add", "ghost", () => openTodoDialog());
  add.title = "Add an item; you can also say “add a new task …”";
  const count = el("span", { class: "muted" }, openCount === 1 ? "1 open" : `${openCount} open`);
  return el("div", { class: "detail-head todo-head" }, el("h2", {}, "To-do"), count, add);
}

/** The item deleted last, with an Undo, so a deletion is never silent. */
function undoLine({ lastDeleted }: TodoListView): HTMLDivElement[] {
  if (!lastDeleted) return [];
  const undo = button("Undo", "ghost", () => void act(`/api/todo-items/${lastDeleted.id}/restore`));
  return [el("div", { class: "todo-undo" }, el("span", {}, `Deleted “${lastDeleted.title}”.`), undo)];
}

function itemList(items: TodoItemView[]): HTMLElement {
  if (!items.length) return el("p", { class: "empty" }, "Nothing to do. Add an item, or ask the assistant to.");
  return el("ul", { class: "todo-list" }, ...items.map(itemCard));
}

function doneFold(done: TodoItemView[]): HTMLDetailsElement[] {
  if (!done.length) return [];
  const fold = el("details", { class: "more todo-done" }, el("summary", {}, `Done (${done.length})`), itemList(done));
  fold.open = doneShown;
  fold.addEventListener("toggle", () => (doneShown = fold.open));
  return [fold];
}

function itemCard(item: TodoItemView): HTMLLIElement {
  const meta = el("div", { class: "todo-meta" }, `#${item.id} · added ${formatWhen(item.createdAt)}`);
  const description = item.description ? el("div", { class: "todo-description" }, item.description) : "";
  return el(
    "li",
    { class: `todo-item${item.done ? " done" : ""}` },
    itemTitle(item),
    description,
    meta,
    itemActions(item),
  );
}

function itemTitle(item: TodoItemView): HTMLLabelElement {
  const tick = el("input", { type: "checkbox", title: item.done ? "Reopen" : "Tick off as done" });
  tick.checked = item.done;
  tick.addEventListener("change", () => void act(`/api/todo-items/${item.id}/done`, { done: tick.checked }));
  const project = item.project ? el("span", { class: "badge" }, item.project) : "";
  return el("label", { class: "todo-title" }, tick, el("span", {}, item.title), project);
}

function itemActions(item: TodoItemView): HTMLDivElement {
  const edit = button("Edit", "ghost", () => openTodoDialog(item));
  const remove = button("Delete", "ghost", () => void act(`/api/todo-items/${item.id}/delete`));
  return el("div", { class: "todo-actions" }, ...sendButton(item), edit, remove);
}

/** An open item with a project goes to that project's worker as a task in one click. */
function sendButton(item: TodoItemView): HTMLButtonElement[] {
  if (!item.project || item.done) return [];
  const send = button(`Send to ${item.project}`, "ghost", () => void act(`/api/todo-items/${item.id}/send`));
  send.title = "Give this item to the project's worker as a task (title and description); it stays open here";
  return [send];
}
