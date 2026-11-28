// A session's right-click menu: "Close other sessions" and "Close all sessions" of its project first, as the most
// used, then "Compact context"; the session list ends with the same two. Sessions whose worker is running
// are skipped and stay open; "Close all" asks first. It lives outside the tabs, because they are rebuilt on every
// state push.

import type { ProjectView, SessionView } from "../protocol.js";
import { closeAllWarning, planCloseAll, planCloseOthers, type SessionSweep } from "../session-sweep.js";
import { act } from "./api.js";
import { button, confirmInDialog, el } from "./dom.js";
import { compactMenuItem } from "./session-compact.js";
import { showProjectNote } from "./project-note.js";

const menu = el("div", { class: "session-menu", role: "menu", hidden: "" });
const closeAllText = el("p", { class: "explanation" });
const closeAllDialog = el(
  "dialog",
  { class: "confirm-dialog", "aria-label": "Close all sessions" },
  el(
    "form",
    { method: "dialog" },
    el("h2", {}, "Close all sessions?"),
    closeAllText,
    el(
      "div",
      { class: "dialog-actions" },
      el("button", { value: "cancel", class: "intent-dismiss" }, "Cancel"),
      el("button", { value: "confirm", class: "danger" }, "Close sessions"),
    ),
  ),
);

export function wireSessionMenu(): void {
  document.body.append(menu, closeAllDialog);
  document.addEventListener("pointerdown", hideUnlessInMenu, { capture: true });
  document.addEventListener("keydown", hideOnEscape, { capture: true }); // before Escape discards a voice message
  window.addEventListener("blur", hideSessionMenu);
  window.addEventListener("resize", hideSessionMenu);
}

/** For a tab's "contextmenu": the menu opens at the pointer, or under the tab when opened from the keyboard. */
export function openSessionMenu(event: MouseEvent, project: ProjectView, session: SessionView): void {
  event.preventDefault();
  const compact = compactMenuItem(project, session, hideSessionMenu);
  const closing = [closeOthersItem(project, session.id), closeAllItem(project)];
  menu.replaceChildren(...closing, menuSeparator(), compact);
  menu.hidden = false;
  placeMenu(event);
  menu.querySelector<HTMLButtonElement>("button:enabled")?.focus();
}

function menuSeparator(): HTMLHRElement {
  return el("hr", { class: "session-menu-separator" });
}

function placeMenu(event: MouseEvent): void {
  const tab = event.currentTarget instanceof Element ? event.currentTarget.getBoundingClientRect() : undefined;
  const isFromKeyboard = event.clientX === 0 && event.clientY === 0;
  const left = isFromKeyboard && tab ? tab.left : event.clientX;
  const top = isFromKeyboard && tab ? tab.bottom : event.clientY;
  menu.style.left = `${Math.min(left, window.innerWidth - menu.offsetWidth)}px`;
  menu.style.top = `${Math.min(top, window.innerHeight - menu.offsetHeight)}px`;
}

/** Also at the foot of the session list. */
export function closeOthersItem(project: ProjectView, keptId: string): HTMLButtonElement {
  const sweep = planCloseOthers(project.sessions, keptId);
  return menuItem("Close other sessions", sweep, () => void closeOthers(project, keptId));
}

export function closeAllItem(project: ProjectView): HTMLButtonElement {
  const sweep = planCloseAll(project.sessions);
  return menuItem("Close all sessions", sweep, () => confirmCloseAll(project, sweep));
}

/** Nothing to close, when every other session is running or there is none, leaves the item disabled. */
function menuItem(label: string, sweep: SessionSweep, onPick: () => void): HTMLButtonElement {
  const item = button(label, "ghost session-menu-item", () => {
    hideSessionMenu();
    onPick();
  });
  item.setAttribute("role", "menuitem");
  item.disabled = !sweep.closing.length;
  if (sweep.skipped.length) item.title = "Sessions whose worker is running are skipped and stay open.";
  return item;
}

async function closeOthers(project: ProjectView, keptId: string): Promise<void> {
  const report = await act(`/api/sessions/${keptId}/close-others`);
  if (report !== undefined) showProjectNote(project.name, report);
}

function confirmCloseAll(project: ProjectView, sweep: SessionSweep): void {
  closeAllText.textContent = closeAllWarning(sweep);
  confirmInDialog(closeAllDialog, () => void closeAll(project));
}

async function closeAll(project: ProjectView): Promise<void> {
  const report = await act(`/api/projects/${encodeURIComponent(project.name)}/sessions/close-all`);
  if (report !== undefined) showProjectNote(project.name, report);
}

function hideUnlessInMenu(event: PointerEvent): void {
  const isInMenu = event.target instanceof Node && menu.contains(event.target);
  if (!isInMenu) hideSessionMenu();
}

function hideOnEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape" || menu.hidden) return;
  event.preventDefault();
  hideSessionMenu();
}

function hideSessionMenu(): void {
  menu.hidden = true;
}
