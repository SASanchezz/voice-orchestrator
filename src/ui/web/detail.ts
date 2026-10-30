// The right panel: your to-do list next to the assistant's chat. A selected project has none; its sessions' chat
// takes the right side instead (code-view.ts), with the project's own to-do list as its first tab (project-todo.ts).

import { byId } from "./dom.js";
import { store } from "./store.js";
import { renderTodoPanel } from "./todo-panel.js";

export function renderDetail(): void {
  if (store.selectedProject()) return;
  renderTodoPanel(byId("detail", HTMLElement));
}
