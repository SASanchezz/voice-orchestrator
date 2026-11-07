import type { Registry } from "../../registry/registry.js";
import type { SessionState } from "../../registry/registry-schema.js";
import type { Sessions } from "../../registry/sessions.js";
import { closingIds, planCloseOthers, sweepReport } from "../../ui/session-sweep.js";
import type { SessionControl } from "../../workers/session-control.js";

/** Reaching this many open sessions makes new_session suggest closing the finished ones, once. */
export const CROWDED_SESSION_COUNT = 9;

/** The one thing closing piled-up sessions needs from the workers. */
export type SessionCloser = Pick<SessionControl, "closeOthers">;

/** The session new work goes to, and what new_session says about it. */
export interface NewWorkSession {
  session: SessionState;
  report: string;
}

/** Which session the assistant's new work goes to, and closing the ones it piled up. */
export class WorkSessions {
  constructor(
    private registry: Registry,
    private sessions: Sessions,
    private closer: SessionCloser,
  ) {}

  /** A session nothing was ever sent to is reused, so new work doesn't leave empty tabs behind. */
  openForNewWork(project: string): NewWorkSession {
    const untouched = this.sessions.sessionsOf(project).find(isUntouched);
    if (!untouched) return opened(this.registry.createSession(project));
    this.registry.activate(untouched.id);
    return {
      session: untouched,
      report: `Using ${project} session ${untouched.number}, which was still empty; it is now active.`,
    };
  }

  /** Said only when the project reaches the count, so the model offers the cleanup once, not after every session. */
  crowdingHint(project: string): string {
    const open = this.sessions.sessionsOf(project).length;
    if (open !== CROWDED_SESSION_COUNT) return "";
    return `${project} now has ${open} open sessions: offer once to close the finished ones with close_other_sessions.`;
  }

  /** Every session but the active one, except those whose worker is running. */
  async closeOthers(project: string): Promise<string> {
    const kept = this.registry.activeSession(project);
    const sweep = planCloseOthers(this.sessions.sessionsOf(project), kept.id);
    await this.closer.closeOthers(kept.id, closingIds(sweep));
    return sweepReport(project, sweep);
  }
}

function opened(session: SessionState): NewWorkSession {
  return { session, report: `Opened ${session.project} session ${session.number}; it is now active.` };
}

/** Idle, and never given a task, a queued instruction or another session's handoff. */
export function isUntouched(session: SessionState): boolean {
  const neverWorked = session.task === undefined && !session.history.length && !session.queued.length;
  return session.status === "idle" && neverWorked && session.handoff === undefined;
}
