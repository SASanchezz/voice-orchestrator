import type { ClosedConversations } from "../../workers/closed-conversations.js";
import { reopenedReport, type SessionReopener } from "../../workers/session-reopener.js";
import type { ActionReporter } from "./action-reporter.js";

/** Picking a closed session in the session tabs' ↺ list brings it back. */
export class ReopenActions {
  constructor(
    private closed: ClosedConversations,
    private reopener: SessionReopener,
    private reporter: ActionReporter,
  ) {}

  async reopenSession(project: string, claudeSessionId: string): Promise<string> {
    const conversation = await this.closed.find(project, claudeSessionId);
    const session = await this.reopener.reopen(project, conversation);
    return this.reporter.report(project, reopenedReport(conversation, session));
  }
}
