import type { Projects } from "./projects.js";
import type { SessionState } from "./registry-schema.js";
import type { Sessions } from "./sessions.js";

const TASK_CHARS = 120;
const ERROR_CHARS = 160;
const DETAIL_RESULT_CHARS = 600;

/** What every project and session is doing, in short text for the model. */
export class StatusReport {
  constructor(
    private projects: Projects,
    private sessions: Sessions,
  ) {}

  /** Compact text snapshot for the orchestrator (and for handoffs). */
  snapshot(): string {
    return this.projects
      .all()
      .map((p) => {
        const sessions = this.sessions.sessionsOf(p.name);
        if (sessions.length === 1) return `${p.name} [${p.profile}]: ${describeSession(sessions[0])}`;
        return (
          `${p.name} [${p.profile}], ${sessions.length} sessions:\n` + this.sessionList(p.name).replace(/^/gm, "  ")
        );
      })
      .join("\n");
  }

  /** Everything about a project's active session, for the project_status tool. */
  projectDetail(project: string): string {
    const { profile, activeSession } = this.projects.get(project);
    const session = this.sessions.session(activeSession);
    const openSessions = this.sessions.sessionsOf(project).length;
    const lastResult = session.lastResult?.slice(-DETAIL_RESULT_CHARS);
    return JSON.stringify({ ...session, profile, openSessions, lastResult }, null, 1);
  }

  /** One project's open sessions, for the list_sessions tool. */
  sessionList(project: string): string {
    const active = this.projects.get(project).activeSession;
    return this.sessions
      .sessionsOf(project)
      .map((s) => `session ${s.number}${s.id === active ? " (active)" : ""}: ${describeSession(s)}`)
      .join("\n");
  }
}

function describeSession(s: SessionState): string {
  const bits: string[] = [s.status];
  if (s.task) bits.push(`task="${s.task.slice(0, TASK_CHARS)}"`);
  if (s.queued.length) bits.push(`${s.queued.length} queued`);
  if (s.lastActivity && s.status === "running") bits.push(`now: ${s.lastActivity}`);
  if (s.lastError && s.status === "failed") bits.push(`error: ${s.lastError.slice(0, ERROR_CHARS)}`);
  return bits.join(", ");
}
