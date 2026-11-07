import type { PageOpener } from "../ui/server/page-opener.js";
import { NoticeActions, type ChangeExplainer } from "../ui/notices/notice-actions.js";
import { NoticeInbox } from "../ui/notices/notice-inbox.js";
import { ShownSessions } from "../ui/notices/shown-sessions.js";
import type { PopupActions } from "../ui/popup-actions.js";
import type { OperatorParts } from "./build-operator.js";

/** The ended tasks waiting in the notice panel, what its buttons do, and which sessions the web UI has on screen. */
export interface NoticeParts {
  inbox: NoticeInbox;
  actions: NoticeActions;
  shownSessions: ShownSessions;
}

export function buildNotices(explainer: ChangeExplainer, popupActions: PopupActions): NoticeParts {
  const inbox = new NoticeInbox();
  return { inbox, actions: new NoticeActions(inbox, popupActions, explainer), shownSessions: new ShownSessions() };
}

/** What every pop-up's buttons do besides answering: open the web UI there, and silence the operator about it. */
export function popupActionsFor(pages: PageOpener, operator: OperatorParts): PopupActions {
  return {
    openPage: (target) => pages.open(target),
    silence: (event) => operator.voices.silence(event),
  };
}
