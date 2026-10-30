// Your words so far while you hold the talk key or a talk gesture, in the listening strip above the message box, so you
// see what the assistant will get as you speak. The strip's own text says whether it is listening or transcribing.

import { byId } from "./dom.js";
import { store } from "./store.js";

let draftWords = "";

export function showVoiceDraft(words: string): void {
  draftWords = words;
  renderVoiceDraft();
}

/** Once your message is sent or dropped, its words go; the next one starts empty. */
export function renderVoiceDraft(): void {
  if (store.state.voiceInput === "idle") draftWords = "";
  const draft = byId("voice-draft", HTMLElement);
  draft.hidden = !draftWords;
  draft.textContent = draftWords;
}
