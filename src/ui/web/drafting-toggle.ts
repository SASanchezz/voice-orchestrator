// The Messages view's Drafting switch: turns automatic drafts for new Slack and Telegram messages off and on again.
// The server keeps the setting, so it holds across restarts; the button shows what the server last said.

import type { DraftingView } from "../reply-views.js";
import { fromServer, post, token } from "./api.js";
import { byId } from "./dom.js";
import { showReplyToast } from "./reply-toast.js";

const DRAFTING_PATH = "/api/replies/drafting";

let draftingOn = true;

export function wireDraftingToggle(): void {
  byId("drafting-toggle", HTMLButtonElement).addEventListener("click", () => void toggleDrafting());
  void refreshDrafting();
}

async function refreshDrafting(): Promise<void> {
  try {
    showDrafting(await fetchDrafting());
  } catch {
    // the server is restarting; the button keeps what it showed
  }
}

async function fetchDrafting(): Promise<boolean> {
  const res = await fetch(`${DRAFTING_PATH}?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(res.statusText);
  return fromServer<DraftingView>(await res.json()).on;
}

async function toggleDrafting(): Promise<void> {
  try {
    const message = await post(DRAFTING_PATH, { on: !draftingOn });
    showDrafting(!draftingOn);
    if (message) showReplyToast(message);
  } catch (error) {
    showReplyToast(error instanceof Error ? error.message : String(error));
  }
}

function showDrafting(on: boolean): void {
  draftingOn = on;
  const button = byId("drafting-toggle", HTMLButtonElement);
  button.textContent = on ? "Drafting on" : "Drafting off";
  button.setAttribute("aria-pressed", String(on));
  button.title = on ? "New messages get drafted replies. Click to pause." : "Paused: new messages get no drafts.";
}
