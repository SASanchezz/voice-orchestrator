import type { SessionQueue } from "./session-queue.js";
import type { SessionRuns } from "./session-runs.js";
import type { WorkerDirectory } from "./worker-directory.js";

/** A paused queue, after a task failed or was stopped: moved on again, or dropped whole. */
export class QueueControl {
  constructor(
    private queue: SessionQueue,
    private runs: Pick<SessionRuns, "resume">,
    private directory: WorkerDirectory,
  ) {}

  /** At once when the session is idle; after its running task otherwise. */
  resume(sessionId: string): string {
    const label = this.directory.labelOf(sessionId);
    const count = this.queue.itemsOf(sessionId).length;
    if (!count) return `${label} has nothing queued.`;
    void this.runs.resume(sessionId);
    return `Resumed ${label}'s queue; ${count} to go.`;
  }

  clear(sessionId: string): string {
    const label = this.directory.labelOf(sessionId);
    const count = this.queue.itemsOf(sessionId).length;
    this.queue.clear(sessionId);
    return count ? `Cleared ${label}'s queue; ${count} removed.` : `${label} has nothing queued.`;
  }
}
