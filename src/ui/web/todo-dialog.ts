// Adding or editing a to-do item in a dialog: its title, description and project.

import type { TodoItemView } from "../protocol.js";
import { act } from "./api.js";
import { byId, el } from "./dom.js";
import { store } from "./store.js";

const SAVE = "save";
const NO_PROJECT = "";

/** The item being edited; undefined while adding a new one. */
let editing: TodoItemView | undefined;

export function wireTodoDialog(): void {
  const dialog = byId("todo-dialog", HTMLDialogElement);
  dialog.addEventListener("close", () => {
    if (dialog.returnValue === SAVE) void save();
  });
  byId("todo-cancel", HTMLButtonElement).addEventListener("click", () => dialog.close());
}

export function openTodoDialog(item?: TodoItemView): void {
  openDialog(item, item?.project ?? NO_PROJECT);
}

/** A new item, already set on the project. */
export function openTodoDialogIn(project: string): void {
  openDialog(undefined, project);
}

function openDialog(item: TodoItemView | undefined, project: string): void {
  editing = item;
  byId("todo-dialog-title", HTMLElement).textContent = item ? `Edit #${item.id}` : "New to-do item";
  byId("todo-title-input", HTMLInputElement).value = item?.title ?? "";
  byId("todo-description-input", HTMLTextAreaElement).value = item?.description ?? "";
  fillProjects(project);
  const dialog = byId("todo-dialog", HTMLDialogElement);
  dialog.returnValue = "";
  dialog.showModal();
}

function fillProjects(selected: string): void {
  const names = store.state.projects.map((project) => project.name);
  if (selected && !names.includes(selected)) names.push(selected); // a removed project shows, so the item isn't moved off it unnoticed
  const options = [
    el("option", { value: NO_PROJECT }, "No project"),
    ...names.map((name) => el("option", { value: name }, name)),
  ];
  const select = byId("todo-project-input", HTMLSelectElement);
  select.replaceChildren(...options);
  select.value = selected;
}

async function save(): Promise<void> {
  const body = {
    title: byId("todo-title-input", HTMLInputElement).value,
    description: byId("todo-description-input", HTMLTextAreaElement).value,
    project: byId("todo-project-input", HTMLSelectElement).value,
  };
  await act(editing ? `/api/todo-items/${editing.id}/edit` : "/api/todo-items", body);
}
