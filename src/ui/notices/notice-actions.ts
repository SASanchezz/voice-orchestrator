import type { TaskEndEvent } from "../../events/app-events.js";
import type { ChangeSummarizer } from "../../workers/change-summarizer.js";
import type { NoticeTarget } from "../notice-protocol.js";
import type { NavigationTarget } from "../page-target.js";
import type { PopupActions } from "../popup-actions.js";
import type { NoticeInbox } from "./notice-inbox.js";

const GONE = "That notice was closed.";

/** Writes a longer explanation of a project's latest changes, on the project's own account. */
export type ChangeExplainer = Pick<ChangeSummarizer, "explainInWriting">;

/** What the notice panel's buttons do; a reply to the worker goes the way a task typed in the web UI does. */
export class NoticeActions {
  constructor(
    private inbox: NoticeInbox,
    private actions: PopupActions,
    private explainer: ChangeExplainer,
  ) {}

  /**
   * Your first click or keystroke in it: what is said about its task stops, and it no longer closes by itself.
   * One you just closed is already gone, which is fine: closing silenced it.
   */
  markSeen(id: string): string {
    if (!this.inbox.has(id)) return GONE;
    this.actions.silence(this.inbox.eventOf(id));
    this.inbox.markSeen(id);
    return "Seen.";
  }

  /** You closed it: what is said about its task stops too. */
  close(id: string): string {
    if (!this.inbox.has(id)) return GONE;
    this.actions.silence(this.inbox.eventOf(id));
    this.inbox.dismiss(id);
    return "Closed.";
  }

  /** Nobody touched it for a while: it goes, and its spoken announcement is left alone. */
  expire(id: string): string {
    this.inbox.dismiss(id);
    return "Closed.";
  }

  async open(id: string, target: NoticeTarget): Promise<string> {
    this.markSeen(id);
    await this.actions.openPage(navigationOf(target, this.inbox.eventOf(id)));
    return "Opened in the web UI.";
  }

  /** Focused on the task the notice is about; kept with the notice, so asking again costs nothing. */
  async explain(id: string): Promise<string> {
    const { project, task } = this.inbox.eventOf(id);
    const explanation = await this.explainer.explainInWriting(project, task);
    this.inbox.explained(id, explanation);
    return explanation;
  }
}

function navigationOf(target: NoticeTarget, e: TaskEndEvent): NavigationTarget {
  if (target === "review") return { view: "review", project: e.project };
  return { view: target, sessionId: e.session };
}
