import type { Sessions } from "../registry/sessions.js";
import type { WorkerChat } from "./worker-chat.js";
import type { WorkerDirectory } from "./worker-directory.js";
import { modelLabel } from "./worker-models.js";

/** The model each session's worker runs on. A change applies from its next task; one already running keeps its model. */
export class SessionModels {
  constructor(
    private sessions: Sessions,
    private directory: WorkerDirectory,
    private chat: WorkerChat,
  ) {}

  choose(sessionId: string, model: string): string {
    this.sessions.updateSession(sessionId, { model });
    return this.announce(sessionId);
  }

  /** Back to the model config.yaml sets for the project, or Claude Code's default. */
  useProjectModel(sessionId: string): string {
    this.sessions.updateSession(sessionId, { model: undefined });
    return this.announce(sessionId, " (the project's model)");
  }

  private announce(sessionId: string, origin = ""): string {
    const label = modelLabel(this.directory.sessionModelOf(sessionId));
    this.chat.say(sessionId, "status", `Model: ${label}${origin}, from the next task on.`);
    return `${this.sessions.labelOf(sessionId)} now runs on ${label}${origin}.`;
  }
}
