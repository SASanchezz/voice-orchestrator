// Tells the server which worker session this page has on screen, so a task ending there brings up no notice panel.

import { report } from "./api.js";
import { PAGE_ID } from "./page-id.js";
import { store } from "./store.js";

const SHOWN_SESSION_PATH = "/api/shown-session";

let lastReported: string | undefined;

/** Says it even if unchanged: a restarted server knows of no page. */
export function reportShownSession(): void {
  lastReported = shownSession();
  report(SHOWN_SESSION_PATH, { page: PAGE_ID, session: lastReported });
}

export function reportShownSessionChange(): void {
  if (shownSession() !== lastReported) reportShownSession();
}

/** A page hidden behind another tab, or leaving, shows no session; one coming back shows its own again. */
export function wireShownSessionReport(): void {
  document.addEventListener("visibilitychange", reportShownSessionChange);
  window.addEventListener("pagehide", reportLeaving);
  window.addEventListener("pageshow", reportShownSessionChange);
}

function reportLeaving(): void {
  lastReported = undefined;
  report(SHOWN_SESSION_PATH, { page: PAGE_ID });
}

/** The selected project's session, while its chat or code is on screen rather than its To-do or Review. */
function shownSession(): string | undefined {
  if (document.visibilityState !== "visible") return undefined;
  const project = store.selectedProject();
  const isSessionOnScreen = project && !store.projectTodoShown && !store.reviewShown;
  return isSessionOnScreen ? project.activeSession : undefined;
}
