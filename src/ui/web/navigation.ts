// Going where a notice's button points: the assistant's reply to a session's latest task, or the session itself.
// By voice: a project's chat or its code.

import { isProjectTarget, parsePageHash, type PageTarget, type ProjectTarget } from "../page-target.js";
import type { ChatView } from "./chat.js";
import { openSessionById } from "./session-link.js";
import { store } from "./store.js";

export async function navigate(target: PageTarget | ProjectTarget, chat: ChatView): Promise<void> {
  if (isProjectTarget(target)) return showProject(target);
  if (target.view === "session") return openSessionById(target.sessionId);
  store.select(""); // the assistant's chat
  chat.revealTaskReply(target.sessionId);
}

/** Chat and code are side by side, so either target just shows the project. */
function showProject({ project }: ProjectTarget): void {
  store.select(project);
}

/** A page opened from a notice's link goes there once its chat has loaded; the #hash is cleared after. */
export function navigateFromLink(chat: ChatView): void {
  const target = parsePageHash(location.hash);
  if (!target) return;
  history.replaceState(null, "", location.pathname + location.search);
  void navigate(target, chat);
}
