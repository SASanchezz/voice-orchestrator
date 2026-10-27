// The red Force stop button next to Send: it kills the active session's running task.

import { isBusy } from "../running-tasks.js";
import { act } from "./api.js";
import { byId, el } from "./dom.js";
import { activeSession, store } from "./store.js";

const FORCE_STOP_ID = "force-stop";
const LABEL_ID = "force-stop-label";
const READY_LABEL = "Force stop";
const STOPPING_LABEL = "Stopping…";
/** Claude Code is killed outright 5 s after the stop; past this, a task still shown as busy may be stopped again. */
const RETRY_AFTER_MS = 10_000;

/** Puts the button in the message box, before Send; renderForceStop shows it while there is a task to stop. */
export function wireForceStop(): void {
  const composer = byId("composer", HTMLFormElement);
  const icon = el("span", { class: "force-stop-icon", "aria-hidden": "true" });
  const label = el("span", { id: LABEL_ID }, READY_LABEL);
  const stop = el("button", { type: "button", class: "force-stop", id: FORCE_STOP_ID }, icon, label);
  stop.hidden = true;
  stop.addEventListener("click", () => void forceStopShownSession());
  composer.insertBefore(stop, composer.querySelector('button[type="submit"]'));
}

/** Shown while the selected project's active session runs a task or waits for your permission. */
export function renderForceStop(): void {
  const stop = byId(FORCE_STOP_ID, HTMLButtonElement);
  const project = store.selectedProject();
  const session = project ? activeSession(project) : undefined;
  const busy = session !== undefined && isBusy(session);
  stop.hidden = !busy;
  const stillStopping = busy && stop.dataset.stopping === session.id;
  if (!stillStopping) showReady(stop); // the stop finished, or another session is shown
  if (!session) return;
  stop.dataset.session = session.id;
  stop.title =
    `Kill session ${session.number}'s running task now (its Claude Code process is ended, forcibly after 5 s) ` +
    "and clear its queue. Other sessions keep running.";
  stop.setAttribute("aria-label", `Force stop session ${session.number}`);
}

/** Greyed out from the click until the task is gone; a failed request, or a task that outlives the kill, frees it again. */
async function forceStopShownSession(): Promise<void> {
  const stop = byId(FORCE_STOP_ID, HTMLButtonElement);
  const sessionId = stop.dataset.session;
  if (!sessionId || stop.disabled) return;
  showStopping(stop, sessionId);
  const sent = await act(`/api/sessions/${sessionId}/stop`);
  if (sent === undefined) return showReady(stop);
  setTimeout(() => {
    if (stop.dataset.stopping === sessionId) showReady(stop);
  }, RETRY_AFTER_MS);
}

function showStopping(stop: HTMLButtonElement, sessionId: string): void {
  stop.dataset.stopping = sessionId;
  stop.disabled = true;
  stop.setAttribute("aria-busy", "true");
  byId(LABEL_ID, HTMLElement).textContent = STOPPING_LABEL;
}

function showReady(stop: HTMLButtonElement): void {
  delete stop.dataset.stopping;
  stop.disabled = false;
  stop.removeAttribute("aria-busy");
  byId(LABEL_ID, HTMLElement).textContent = READY_LABEL;
}
