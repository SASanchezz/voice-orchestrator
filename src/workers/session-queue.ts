import type { Sessions } from "../registry/sessions.js";

/** Instructions waiting for a session's worker to finish its current task. */
export class SessionQueue {
  constructor(private sessions: Sessions) {}

  /** Returns the instruction's place in the queue, from 1. */
  add(sessionId: string, instruction: string): number {
    const queued = [...this.sessions.session(sessionId).queued, instruction];
    this.sessions.updateSession(sessionId, { queued, queuedAt: new Date().toISOString() });
    return queued.length;
  }

  /** Takes the next instruction off the queue, but only after a task that succeeded. */
  takeNext(sessionId: string): string | undefined {
    const { status, queued } = this.sessions.session(sessionId);
    const next = status === "done" ? queued[0] : undefined;
    if (next) this.sessions.updateSession(sessionId, { queued: queued.slice(1) });
    return next;
  }

  queuedOf(sessionId: string): string[] {
    return this.sessions.session(sessionId).queued;
  }

  /** Takes the instruction at `index` (from 0) off the queue, leaving the others in order; returns it. */
  removeAt(sessionId: string, index: number): string {
    const queued = this.queuedOf(sessionId);
    const removed = queued[index];
    if (removed === undefined) throw new Error(`Nothing is queued at #${index + 1}.`);
    this.sessions.updateSession(sessionId, { queued: queued.filter((_, at) => at !== index) });
    return removed;
  }

  clear(sessionId: string): void {
    this.sessions.updateSession(sessionId, { queued: [] });
  }
}
