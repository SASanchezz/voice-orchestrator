// The session list that drops from the active session's tab: every session named by what it is about, each with its
// own stop and close, then "Close other sessions" and "Close all sessions". It is rebuilt on every state push and
// stays open across them.

import type { ProjectView } from "../protocol.js";
import { el } from "./dom.js";
import { sessionPickerRow } from "./session-picker-item.js";
import { closeAllItem, closeOthersItem } from "./session-menu.js";
import { store } from "./store.js";

const PICKER_SELECTOR = ".session-picker, .session-picker-toggle";

let isOpen = false;

export function wireSessionPicker(): void {
  document.addEventListener("pointerdown", closeUnlessInPicker, { capture: true });
  document.addEventListener("keydown", closeOnEscape, { capture: true }); // before Escape discards a voice message
  window.addEventListener("blur", closeSessionPicker);
}

export function isSessionPickerOpen(): boolean {
  return isOpen;
}

export function toggleSessionPicker(): void {
  isOpen = !isOpen;
  store.rerender();
}

/** The list while it is open, else nothing. */
export function sessionPicker(project: ProjectView): HTMLDivElement[] {
  if (!isOpen) return [];
  const rows = project.sessions.map((session) => sessionPickerRow(project, session, closeSessionPicker));
  const separator = el("hr", { class: "session-menu-separator" });
  const sweeps = el("div", { class: "session-picker-sweeps" }, ...sweepItems(project));
  const attrs = { class: "session-picker", role: "listbox", "aria-label": "Sessions" };
  return [el("div", attrs, ...rows, separator, sweeps)];
}

/** "Close other sessions" keeps the active one. */
function sweepItems(project: ProjectView): HTMLButtonElement[] {
  const items = [closeOthersItem(project, project.activeSession), closeAllItem(project)];
  items.forEach((item) => item.addEventListener("click", closeSessionPicker));
  return items;
}

function closeSessionPicker(): void {
  if (!isOpen) return;
  isOpen = false;
  store.rerender();
}

function closeUnlessInPicker(event: PointerEvent): void {
  const isInPicker = event.target instanceof Element && event.target.closest(PICKER_SELECTOR) !== null;
  if (!isInPicker) closeSessionPicker();
}

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !isOpen) return;
  event.preventDefault();
  closeSessionPicker();
}
