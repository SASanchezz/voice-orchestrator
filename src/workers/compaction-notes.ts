import { contextPercentOf } from "../budget/budget-levels.js";
import type { SessionState } from "../registry/registry-schema.js";
import type { Sessions } from "../registry/sessions.js";
import { errorMessage } from "../shared/errors.js";
import type { ContextShrink } from "./context-compactor.js";
import type { WorkerChat } from "./worker-chat.js";

/** What the session's tab shows it working on while it compacts. */
const COMPACT_TASK = "Compact context";

const now = (): string => new Date().toISOString();

/**
 * Writes down compacting a session as its tab and chat show a task: running while it compacts, then done with its new
 * size and conversation, failed or stopped. Only after a step that succeeded does its queue move on.
 */
export class CompactionNotes {
  constructor(
    private sessions: Sessions,
    private chat: WorkerChat,
  ) {}

  started(session: SessionState): void {
    const patch = { status: "running", task: COMPACT_TASK, startedAt: now(), lastError: undefined } as const;
    this.sessions.updateSession(session.id, { ...patch, lastActivity: undefined });
    this.chat.say(session.id, "status", `Compacting session ${session.number}'s context…`);
  }

  /** Returns the same line it adds to the session's chat. */
  done(session: SessionState, shrink: ContextShrink): string {
    const patch = { status: "done", finishedAt: now(), claudeSessionId: shrink.conversationId } as const;
    this.sessions.updateSession(session.id, { ...patch, contextTokens: shrink.tokensAfter });
    const line = CompactionNotes.lineFor(session, shrink);
    this.chat.say(session.id, "status", line);
    return line;
  }

  failed(session: SessionState, error: unknown): void {
    const message = `Couldn't compact session ${session.number}'s context: ${errorMessage(error)}`;
    this.sessions.updateSession(session.id, { status: "failed", lastError: message, finishedAt: now() });
    this.chat.sayFailure(session.id, message);
  }

  stopped(session: SessionState): void {
    this.sessions.updateSession(session.id, { status: "stopped", finishedAt: now() });
    this.chat.say(session.id, "status", `Stopped compacting session ${session.number}'s context.`);
  }

  /** In percent of the session's context window, as its tab's meter shows it. */
  private static lineFor(session: SessionState, { tokensBefore, tokensAfter }: ContextShrink): string {
    const before = contextPercentOf({ contextTokens: tokensBefore, contextWindow: session.contextWindow });
    if (tokensAfter === undefined) return `Compacted session ${session.number}'s context; it was at ${before}%.`;
    const after = contextPercentOf({ contextTokens: tokensAfter, contextWindow: session.contextWindow });
    return `Compacted session ${session.number}'s context from ${before}% to ${after}%.`;
  }
}
