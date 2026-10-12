// Going where a notice's button points: the assistant's reply to a session's latest task, or the session itself.

import { parsePageHash, type PageTarget } from "../page-target.js";
import type { ChatView } from "./chat.js";
import { openSessionById } from "./session-link.js";
import { store } from "./store.js";

export async function navigate(target: PageTarget, chat: ChatView): Promise<void> {
  if (target.view === "session") return openSessionById(target.sessionId);
  store.select(""); // the assistant's chat
  chat.revealTaskReply(target.sessionId);
}

/** A page opened from a notice's link goes there once its chat has loaded; the #hash is cleared after. */
export function navigateFromLink(chat: ChatView): void {
  const target = parsePageHash(location.hash);
  if (!target) return;
  history.replaceState(null, "", location.pathname + location.search);
  void navigate(target, chat);
}
