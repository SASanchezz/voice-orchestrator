// The notice panel's page: its parts, and drawing the notice on show from the server's latest state.

import type { NoticeView } from "../../notice-protocol.js";
import { NoticeSelection } from "../../notice-selection.js";
import type { SessionView } from "../../protocol.js";
import { DictationBox } from "../dictation-box.js";
import { byId } from "../dom.js";
import { store } from "../store.js";
import { HoverHints } from "./hover-hints.js";
import { NoticeContent } from "./notice-content.js";
import { NoticeReply } from "./notice-reply.js";
import type { PointerListener } from "./panel-bridge.js";

export const selection = new NoticeSelection();
export const content = new NoticeContent();
export const box = new DictationBox({
  input: byId("reply-input", HTMLTextAreaElement),
  mic: byId("reply-mic", HTMLButtonElement),
  cancel: byId("reply-mic-cancel", HTMLButtonElement),
  send: byId("reply-send", HTMLButtonElement),
});
export const reply = new NoticeReply(box, byId("reply-input", HTMLTextAreaElement));
export const hints = new HoverHints(byId("hover-hint", HTMLElement));

let isPointerInside = false;

/** The pointer over the panel keeps its notices from closing by themselves, and brings up the buttons' hints. */
export const pointer: PointerListener = {
  moved: (x, y) => {
    isPointerInside = true;
    hints.pointAt(x, y);
  },
  left: () => {
    isPointerInside = false;
    hints.forget();
  },
};

export function shownNotice(): NoticeView | undefined {
  return selection.shown(store.state.notices);
}

/** You are reading or answering: notices stay where they are. */
export function isBusy(): boolean {
  return isPointerInside || reply.isBusy();
}

export function render(): void {
  const { notices } = store.state;
  selection.follow(notices, reply.isBusy());
  const notice = selection.shown(notices);
  byId("notice", HTMLElement).hidden = !notice;
  if (!notice) return;
  content.render(notice, selection.positionIn(notices), notices.length);
  reply.render(notice, sessionOf(notice.sessionId));
  byId("reply-mic", HTMLButtonElement).hidden = store.state.gestures === "unavailable"; // text mode has no mic
}

function sessionOf(id: string): SessionView | undefined {
  return store.state.projects.flatMap((p) => p.sessions).find((s) => s.id === id);
}
