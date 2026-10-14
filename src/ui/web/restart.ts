// The header's Restart button: restarts the whole app, as asking the assistant to does, and reloads the page
// once the app is back.

import { restartWarning, runningTaskCount } from "../running-tasks.js";
import { act } from "./api.js";
import { byId, confirmInDialog } from "./dom.js";
import { store } from "./store.js";

const RESTART_LABEL = "Restart";
const RESTARTING_LABEL = "Restarting…";

/** Set once the restart is asked for; the live events connecting again then means the app is back. */
let restarting = false;

export function wireRestart(): void {
  byId("restart-button", HTMLButtonElement).addEventListener("click", askToRestart);
}

/** For the live events' "open": reconnecting after a restart reloads the page, so it runs the new app's script. */
export function reloadIfRestarted(): void {
  if (restarting) location.reload();
}

/** Running tasks are stopped by a restart, so you confirm first; with none running it restarts at once. */
function askToRestart(): void {
  const runningTasks = runningTaskCount(store.state.projects);
  if (!runningTasks) return void restart();
  byId("restart-warning", HTMLElement).textContent = restartWarning(runningTasks);
  confirmInDialog(byId("restart-dialog", HTMLDialogElement), () => void restart());
}

async function restart(): Promise<void> {
  restarting = true;
  showRestarting();
  const sent = await act("/api/restart");
  if (sent !== undefined) return;
  restarting = false;
  showRestartable();
}

function showRestarting(): void {
  const restartButton = byId("restart-button", HTMLButtonElement);
  restartButton.textContent = RESTARTING_LABEL;
  restartButton.disabled = true;
}

/** Back to a working button when the server refused the restart. */
function showRestartable(): void {
  const restartButton = byId("restart-button", HTMLButtonElement);
  restartButton.textContent = RESTART_LABEL;
  restartButton.disabled = false;
}
