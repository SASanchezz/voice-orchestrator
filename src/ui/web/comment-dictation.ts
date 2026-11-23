// 🎙 on a Review comment box: your words fill it as you speak. ■, Enter or typing stops and leaves them to edit;
// Send, the talk key again or saying "finish" sends the comment to a new session, as typing it and clicking would.

import { BoxNews } from "./box-news.js";
import { DictationBox } from "./dictation-box.js";
import { el } from "./dom.js";
import { claimVoiceBox } from "./voice-box-router.js";

const DESTINATION = "→ new session";

/** The comment box's parts a recording needs. */
export interface CommentParts {
  form: HTMLFormElement;
  input: HTMLTextAreaElement;
  send: HTMLButtonElement;
}

/** Its mic and ✕ buttons, for the form to show; the next recording its 🎙 starts fills this box. */
export function commentDictation(parts: CommentParts, sendComment: () => void): HTMLButtonElement[] {
  const mic = el("button", { type: "button", class: "ghost mic-button" }, "🎙");
  const cancel = el(
    "button",
    { type: "button", class: "ghost mic-cancel", title: "Cancel the recording", hidden: "" },
    "✕",
  );
  const dictation = new DictationBox({ ...parts, mic, cancel, sendFinished: sendComment });
  dictation.wire(parts.form);
  const news = new BoxNews(dictation, { describe: () => DESTINATION, send: sendComment });
  mic.addEventListener("click", () => claimVoiceBox(news), { capture: true }); // before it records
  return [mic, cancel];
}
