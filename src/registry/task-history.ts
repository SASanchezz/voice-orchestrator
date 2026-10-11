import type { Projects } from "./projects.js";
import type { TaskRecord } from "./registry-schema.js";
import type { Sessions } from "./sessions.js";

const HISTORY_PER_SESSION = 10;
const HISTORY_RESULT_CHARS = 1500;
const RECENT_TASKS_IN_PROMPT = 3;
const RECENT_TASK_CHARS = 120;
const RECENT_RESULT_CHARS = 240;
const TIMESTAMP_CHARS = 16;

/** Finished tasks per session, kept across restarts so you can refer back to earlier work. */
export class TaskHistory {
  constructor(
    private projects: Projects,
    private sessions: Sessions,
  ) {}

  record(sessionId: string, record: Omit<TaskRecord, "finishedAt">): void {
    const entry = {
      ...record,
      result: record.result.slice(-HISTORY_RESULT_CHARS),
      finishedAt: new Date().toISOString(),
    };
    const history = [...this.sessions.session(sessionId).history, entry].slice(-HISTORY_PER_SESSION);
    this.sessions.updateSession(sessionId, { history });
  }

  /** Full task history of one project across its open sessions, newest last. */
  historyOf(name: string): string {
    const history = this.projectHistory(name);
    if (!history.length) return `No finished tasks recorded for ${name}.`;
    return history.map((h) => `${when(h)} [${h.outcome}] ${h.task}\nResult: ${h.result}`).join("\n\n");
  }

  /** The last few tasks per project, short enough for a system prompt. */
  recentWork(): string {
    return this.projects
      .all()
      .map((p) => [p.name, this.projectHistory(p.name)] as const)
      .filter(([, history]) => history.length)
      .map(([name, history]) => `${name}:\n` + history.slice(-RECENT_TASKS_IN_PROMPT).map(recentLine).join("\n"))
      .join("\n");
  }

  private projectHistory(name: string): TaskRecord[] {
    return this.sessions
      .sessionsOf(name)
      .flatMap((s) => s.history)
      .toSorted((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  }
}

function recentLine(h: TaskRecord): string {
  return `- ${when(h)} [${h.outcome}] ${h.task.slice(0, RECENT_TASK_CHARS)} -> ${h.result.slice(-RECENT_RESULT_CHARS)}`;
}

function when(h: TaskRecord): string {
  return h.finishedAt.slice(0, TIMESTAMP_CHARS);
}
