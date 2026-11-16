// The composer's mic button and the recordings its message box follows, whatever started them: your words appear in
// the box as you speak, after what it already held. ■ or Enter stops and leaves them to edit; the talk key again or
// saying "finish" sends them, with the files attached, to where you were when you started. Esc drops what you just said.

import type { AttachmentTray } from "./attachments.js";
import { BoxNews } from "./box-news.js";
import { sendSpokenMessage } from "./conversation.js";
import { DictationBox } from "./dictation-box.js";
import { byId } from "./dom.js";
import { store } from "./store.js";

let news: BoxNews | undefined;

export function wireMicButton(tray: AttachmentTray): void {
  const box = new DictationBox({
    input: byId("composer-input", HTMLTextAreaElement),
    mic: byId("mic-button", HTMLButtonElement),
    cancel: byId("mic-cancel", HTMLButtonElement),
    send: byId("composer-send", HTMLButtonElement),
    target: byId("mic-target", HTMLElement),
  });
  box.wire(byId("composer", HTMLFormElement));
  news = new BoxNews(box, { describe: destinationOf, send: (session) => sendSpokenMessage(tray, session) });
}

/** Text mode has no mic, so no button. */
export function renderMicButton(): void {
  byId("mic-button", HTMLButtonElement).hidden = store.state.gestures === "unavailable";
}

export function followMicNews(events: EventSource): void {
  news?.follow(events);
}

/** "→ app · session 2" for the session in front when you started talking, or "→ Assistant". */
function destinationOf(session: string | undefined): string {
  for (const project of store.state.projects) {
    const inFront = project.sessions.find((shown) => shown.id === session);
    if (inFront) return `→ ${project.name} · session ${inFront.number}`;
  }
  return "→ Assistant";
}
