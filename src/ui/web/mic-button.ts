// The composer's mic button: click to record on this Mac. Your words appear in the message box as you speak, after
// what it already held; click again or press Enter to stop, and they stay there to edit and send. ✕ or Esc discards
// the recording and puts back what the box held before.

import { DictationBox } from "./dictation-box.js";
import { byId } from "./dom.js";
import { store } from "./store.js";

let box: DictationBox | undefined;

export function wireMicButton(): void {
  box = new DictationBox({
    input: byId("composer-input", HTMLTextAreaElement),
    mic: byId("mic-button", HTMLButtonElement),
    cancel: byId("mic-cancel", HTMLButtonElement),
    send: byId("composer-send", HTMLButtonElement),
  });
  box.wire(byId("composer", HTMLFormElement));
}

/** Text mode has no mic, so no button. */
export function renderMicButton(): void {
  byId("mic-button", HTMLButtonElement).hidden = store.state.gestures === "unavailable";
}

/** Your words so far, from the server while this page records; another page's recording isn't shown here. */
export function showDictatedWords(words: string): void {
  box?.showWords(words);
}
