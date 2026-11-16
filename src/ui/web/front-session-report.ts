// Tells the server which project tab's session this page has open while you are using it, so the talk key and the
// wake word send your words to that worker. With the assistant's tab open, or another app in front, it says none.

import { report } from "./api.js";
import { isPageInUse, wireFocusChecks } from "./page-focus.js";
import { PAGE_ID } from "./page-id.js";
import { store } from "./store.js";

const FRONT_SESSION_PATH = "/api/front-session";

let lastReported: string | undefined;

/** Says it even if unchanged: a restarted server knows of no page. */
export function reportFrontSession(): void {
  lastReported = sessionInFront();
  report(FRONT_SESSION_PATH, { page: PAGE_ID, session: lastReported });
}

export function reportFrontSessionChange(): void {
  if (sessionInFront() !== lastReported) reportFrontSession();
}

export function wireFrontSessionReport(): void {
  wireFocusChecks(reportFrontSessionChange);
  window.addEventListener("pagehide", reportLeaving);
}

function reportLeaving(): void {
  lastReported = undefined;
  report(FRONT_SESSION_PATH, { page: PAGE_ID });
}

/** Any view of the selected project counts: its chat, code, To-do or Review. */
function sessionInFront(): string | undefined {
  if (!isPageInUse()) return undefined;
  return store.selectedProject()?.activeSession;
}
