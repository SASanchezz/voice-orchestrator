// Keeps every project's changed files up to date while the page is in front. Workers change files without telling the
// page, so it asks.

import { fetchChanges } from "./api.js";
import { store } from "./store.js";

const POLL_MS = 10_000;

export function wireChangePoll(): void {
  void refreshChanges();
  setInterval(refreshWhileShown, POLL_MS);
  document.addEventListener("visibilitychange", refreshWhileShown);
}

function refreshWhileShown(): void {
  if (document.visibilityState === "visible") void refreshChanges();
}

export async function refreshChanges(): Promise<void> {
  try {
    store.receiveChanges(await fetchChanges());
  } catch {
    // the server is restarting; the next poll catches up
  }
}
