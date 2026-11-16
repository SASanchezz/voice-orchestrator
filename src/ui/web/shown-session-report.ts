// Tells the server which worker session this page has on screen while you are using it, so a task ending there brings
// up no notice panel. With another app in front, even with this page still visible behind it, it shows none.

import { report } from "./api.js";
import { isPageInUse, wireFocusChecks } from "./page-focus.js";
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

/** A page hidden behind another tab or app, or leaving, shows no session; one coming back shows its own again. */
export function wireShownSessionReport(): void {
  document.addEventListener("visibilitychange", reportShownSessionChange);
  wireFocusChecks(reportShownSessionChange);
  window.addEventListener("pagehide", reportLeaving);
  window.addEventListener("pageshow", reportShownSessionChange);
}

function reportLeaving(): void {
  lastReported = undefined;
  report(SHOWN_SESSION_PATH, { page: PAGE_ID });
}

/** The selected project's session, while its chat or code is on screen rather than its To-do or Review. */
function shownSession(): string | undefined {
  if (!isPageInUse()) return undefined;
  const project = store.selectedProject();
  const isSessionOnScreen = project && !store.projectTodoShown && !store.reviewShown;
  return isSessionOnScreen ? project.activeSession : undefined;
}
