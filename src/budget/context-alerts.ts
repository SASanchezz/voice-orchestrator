import type { AppEvents } from "../events/app-events.js";
import type { Sessions } from "../registry/sessions.js";
import type { WorkerChat } from "../workers/worker-chat.js";
import type { BudgetLevel } from "./budget-levels.js";

/** Says once when a session's context gets large: a line in its chat, and when it is critical, a spoken event. */
export class ContextAlerts {
  constructor(
    private chat: WorkerChat,
    private events: AppEvents,
    private sessions: Sessions,
  ) {}

  raised(sessionId: string, level: Exclude<BudgetLevel, "ok">, percent: number): void {
    this.chat.say(sessionId, "status", contextLine(level, percent));
    if (level === "critical") this.emitFull(sessionId, percent);
  }

  private emitFull(sessionId: string, percent: number): void {
    const { project, number: sessionNumber } = this.sessions.session(sessionId);
    const label = this.sessions.labelOf(sessionId);
    this.events.emitEvent({ kind: "context_full", project, session: sessionId, label, sessionNumber, percent });
  }
}

function contextLine(level: Exclude<BudgetLevel, "ok">, percent: number): string {
  if (level === "warn") return `Context is ${percent}% full; every further turn costs more.`;
  return `Context is ${percent}% full. Hand this session off to a new one (in the session panel) to keep costs down.`;
}
