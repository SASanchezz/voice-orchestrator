import type { Registry } from "../registry/registry.js";
import type { SessionState } from "../registry/registry-schema.js";
import type { Sessions } from "../registry/sessions.js";
import type { WorkerChat } from "./worker-chat.js";

/** Opens the session that takes over from another, carrying its handoff summary. */
export class SessionSuccessor {
  constructor(
    private registry: Registry,
    private sessions: Sessions,
    private chat: WorkerChat,
  ) {}

  /** The new session becomes the project's active one; the summary shows in its chat and starts its first task. */
  open(from: SessionState, summary: string): SessionState {
    const next = this.registry.createSession(from.project);
    this.sessions.updateSession(next.id, { handoff: summary });
    this.chat.say(next.id, "status", `Handoff from session ${from.number}:\n\n${summary}`);
    return next;
  }
}
