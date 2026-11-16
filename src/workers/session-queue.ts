import type { Sessions } from "../registry/sessions.js";
import { fromQueuedEntry, instructionOf, type QueuedTask, toQueuedEntry } from "./queued-task.js";

/** Instructions waiting for a session's worker to finish its current task. */
export class SessionQueue {
  constructor(private sessions: Sessions) {}

  /** Returns the task's place in the queue, from 1. */
  add(sessionId: string, task: QueuedTask): number {
    const queued = [...this.sessions.session(sessionId).queued, toQueuedEntry(task)];
    this.sessions.updateSession(sessionId, { queued, queuedAt: new Date().toISOString() });
    return queued.length;
  }

  /** Takes the next task off the queue, but only after a task that succeeded. */
  takeNext(sessionId: string): QueuedTask | undefined {
    const { status, queued } = this.sessions.session(sessionId);
    const next = status === "done" ? queued[0] : undefined;
    if (next === undefined) return undefined;
    this.sessions.updateSession(sessionId, { queued: queued.slice(1) });
    return fromQueuedEntry(next);
  }

  queuedOf(sessionId: string): string[] {
    return this.sessions.session(sessionId).queued.map(instructionOf);
  }

  /** Takes the instruction at `index` (from 0) off the queue, leaving the others in order; returns it. */
  removeAt(sessionId: string, index: number): string {
    const { queued } = this.sessions.session(sessionId);
    const removed = queued[index];
    if (removed === undefined) throw new Error(`Nothing is queued at #${index + 1}.`);
    this.sessions.updateSession(sessionId, { queued: queued.filter((_, at) => at !== index) });
    return instructionOf(removed);
  }

  clear(sessionId: string): void {
    this.sessions.updateSession(sessionId, { queued: [] });
  }
}
