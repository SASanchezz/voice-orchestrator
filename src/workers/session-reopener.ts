import type { Registry } from "../registry/registry.js";
import type { SessionState } from "../registry/registry-schema.js";
import type { Sessions } from "../registry/sessions.js";
import type { ClosedConversation } from "./closed-conversations.js";
import { readTranscriptChat } from "./transcript-chat.js";
import type { WorkerChat } from "./worker-chat.js";

/** The session chat keeps its last 200 lines; the reopened note takes one. */
const RESTORED_LINE_COUNT = 199;

/** Brings a closed session back as a new one whose next task continues its Claude conversation. */
export class SessionReopener {
  constructor(
    private registry: Registry,
    private sessions: Sessions,
    private chat: WorkerChat,
  ) {}

  /** The reopened session becomes the project's active one, with the closed one's chat brought back from its transcript. */
  async reopen(project: string, conversation: ClosedConversation): Promise<SessionState> {
    const restored = await readTranscriptChat(conversation.transcriptFile);
    const session = this.registry.createSession(project);
    this.sessions.updateSession(session.id, {
      claudeSessionId: conversation.claudeSessionId,
      title: conversation.title,
    });
    for (const line of restored.slice(-RESTORED_LINE_COUNT)) this.chat.post({ ...line, session: session.id });
    this.chat.say(session.id, "status", SessionReopener.reopenedNote(conversation));
    return session;
  }

  private static reopenedNote({ title }: ClosedConversation): string {
    return `Reopened the closed session "${title}"; the next task continues its conversation.`;
  }
}

/** What reopening says, by voice or in the feed. */
export function reopenedReport(conversation: ClosedConversation, session: SessionState): string {
  return `Reopened "${conversation.title}" as ${session.project} session ${session.number}; it is now active.`;
}
