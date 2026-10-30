// A session tab's ×: the first click turns it into "Confirm close" for a few seconds, with the warning under the tabs;
// a second click closes the session. A click anywhere else, or waiting, takes it back.

import { ArmedConfirm } from "../armed-confirm.js";
import type { ProjectView, SessionView } from "../protocol.js";
import { isBusy } from "../running-tasks.js";
import { act } from "./api.js";
import { button, el } from "./dom.js";
import { store } from "./store.js";

const CONFIRM_MS = 4000;
const CONFIRMING_SELECTOR = ".session-close.confirming";

const pendingClose = new ArmedConfirm(CONFIRM_MS, () => store.rerender());

/** Caught before the click reaches its target, so a click on another tab's × still arms that one. */
export function wireSessionClose(): void {
  document.addEventListener("click", cancelUnlessConfirming, { capture: true });
  window.addEventListener("blur", () => pendingClose.cancel()); // a click in VS Code's frame never reaches this page
}

function cancelUnlessConfirming(e: MouseEvent): void {
  const isConfirming = e.target instanceof Element && e.target.closest(CONFIRMING_SELECTOR) !== null;
  if (!isConfirming) pendingClose.cancel();
}

export function closeButton(session: SessionView): HTMLButtonElement {
  const isConfirming = pendingClose.isArmed(session.id);
  return isConfirming ? confirmCloseButton(session) : firstCloseButton(session);
}

function firstCloseButton(session: SessionView): HTMLButtonElement {
  const close = button("×", "ghost session-close", () => armClose(session));
  close.title = `Close session ${session.number}`;
  close.setAttribute("aria-label", `Close session ${session.number}`);
  return close;
}

function confirmCloseButton(session: SessionView): HTMLButtonElement {
  const confirm = button("Confirm close", "ghost session-close confirming", () => closeSession(session));
  confirm.title = closeWarning(session);
  confirm.setAttribute("aria-label", `Confirm closing session ${session.number}`);
  return confirm;
}

/** The tabs are rebuilt by now, so the keyboard's focus goes to the new button. */
function armClose(session: SessionView): void {
  pendingClose.arm(session.id);
  document.querySelector<HTMLElement>(CONFIRMING_SELECTOR)?.focus();
}

function closeSession(session: SessionView): void {
  pendingClose.cancel();
  void act(`/api/sessions/${session.id}/close`);
}

/** What closing will do, under the tabs while a close waits for its confirmation. */
export function closeNote(project: ProjectView): HTMLParagraphElement[] {
  const session = project.sessions.find((candidate) => pendingClose.isArmed(candidate.id));
  return session ? [el("p", { class: "session-close-note" }, closeWarning(session))] : [];
}

function closeWarning(session: SessionView): string {
  return `Close session ${session.number}?${isBusy(session) ? " Its worker will be stopped." : ""} Its messages, queue and history are deleted.`;
}
