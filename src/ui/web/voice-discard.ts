// Takes back your voice message while you talk, while it's transcribed, or while it waits behind a reply:
// the Cancel button beside the listening strip, or Escape anywhere on the page.

import { act } from "./api.js";
import { byId } from "./dom.js";
import { store } from "./store.js";

export function wireVoiceDiscard(): void {
  byId("voice-discard", HTMLButtonElement).addEventListener("click", () => void discardVoiceMessage());
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented || !hasVoiceMessage() || isDialogOpen()) return;
    e.preventDefault();
    void discardVoiceMessage();
  });
}

async function discardVoiceMessage(): Promise<void> {
  await act("/api/voice/discard");
}

function hasVoiceMessage(): boolean {
  return store.state.voiceInput !== "idle";
}

/** Escape there closes the dialog; the voice offer's has its own Discard button. */
function isDialogOpen(): boolean {
  return document.querySelector("dialog[open]") !== null;
}
