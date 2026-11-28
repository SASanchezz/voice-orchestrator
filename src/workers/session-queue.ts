import { randomUUID } from "node:crypto";
import type { Sessions } from "../registry/sessions.js";
import type { QueueItem, QueuedTask } from "./queued-task.js";

/** Instructions waiting for a session's worker to finish its current task; paused after one that didn't succeed. */
export class SessionQueue {
  constructor(private sessions: Sessions) {}

  /** Returns the task's place in the queue, from 1. */
  add(sessionId: string, task: QueuedTask): number {
    const queued = [...this.itemsOf(sessionId), { id: randomUUID(), ...task }];
    this.sessions.updateSession(sessionId, { queued, queuedAt: new Date().toISOString() });
    return queued.length;
  }

  itemsOf(sessionId: string): QueueItem[] {
    return this.sessions.session(sessionId).queued;
  }

  isPaused(sessionId: string): boolean {
    return this.sessions.session(sessionId).queuePaused === true;
  }

  /** Takes the next task off the queue, but only after a task that succeeded and while the queue isn't paused. */
  takeNext(sessionId: string): QueueItem | undefined {
    const isDone = this.sessions.session(sessionId).status === "done";
    return isDone && !this.isPaused(sessionId) ? this.takeFirst(sessionId) : undefined;
  }

  takeFirst(sessionId: string): QueueItem | undefined {
    const [first, ...rest] = this.itemsOf(sessionId);
    if (first) this.replace(sessionId, rest);
    return first;
  }

  /** An emptied queue is no longer paused. */
  replace(sessionId: string, queued: QueueItem[]): void {
    const patch = queued.length ? { queued } : { queued, queuePaused: undefined };
    this.sessions.updateSession(sessionId, patch);
  }

  /** The queue keeps its tasks but won't move on by itself; nothing to pause when it is empty. */
  pause(sessionId: string): void {
    if (this.itemsOf(sessionId).length) this.sessions.updateSession(sessionId, { queuePaused: true });
  }

  unpause(sessionId: string): void {
    this.sessions.updateSession(sessionId, { queuePaused: undefined });
  }

  clear(sessionId: string): void {
    this.replace(sessionId, []);
  }
}
