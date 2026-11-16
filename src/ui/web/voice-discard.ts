// Takes back your voice message while you talk, while it's transcribed, or while it waits behind a reply:
// the Cancel button beside the listening strip, or Escape anywhere on the page. When nothing is left to take back,
// it stays quiet.

import { post } from "./api.js";
import { byId, isDialogOpen } from "./dom.js";
import { store } from "./store.js";

export function wireVoiceDiscard(): void {
  byId("voice-discard", HTMLButtonElement).addEventListener("click", () => void discardVoiceMessage());
  document.addEventListener("keydown", (e) => {
    // in a dialog, Escape closes it; the voice offer's dialog has its own Discard button
    if (e.key !== "Escape" || e.defaultPrevented || !hasVoiceMessage() || isDialogOpen()) return;
    e.preventDefault();
    void discardVoiceMessage();
  });
}

async function discardVoiceMessage(): Promise<void> {
  try {
    await post("/api/voice/discard", {});
  } catch {
    // Nothing was left to take back (an empty recording, or the assistant already has it), so there's nothing to show.
  }
}

function hasVoiceMessage(): boolean {
  return store.state.voiceInput !== "idle";
}
