import { pickQueued, type QueuePick, queuedLine } from "./queue-pick.js";
import type { SessionQueue } from "./session-queue.js";
import type { WorkerChat } from "./worker-chat.js";
import type { WorkerDirectory } from "./worker-directory.js";

/** A session's queued instructions: listed by place, and dropped one at a time while its running task goes on. */
export class QueuedTasks {
  constructor(
    private queue: SessionQueue,
    private directory: WorkerDirectory,
    private chat: WorkerChat,
  ) {}

  /** "webshop session 2 has 2 queued: #1 add tests; #2 fix the footer" */
  list(sessionId: string): string {
    const label = this.directory.labelOf(sessionId);
    const queued = this.queue.queuedOf(sessionId);
    if (!queued.length) return `${label} has nothing queued.`;
    return `${label} has ${queued.length} queued: ${queued.map(queuedLine).join("; ")}`;
  }

  remove(sessionId: string, pick: QueuePick): string {
    const label = this.directory.labelOf(sessionId);
    const queued = this.queue.queuedOf(sessionId);
    if (!queued.length) throw new Error(`${label} has nothing queued.`);
    const index = pickQueued(queued, pick);
    const removed = this.queue.removeAt(sessionId, index);
    this.chat.say(sessionId, "status", `Removed from the queue: ${removed}`);
    const left = queued.length - 1;
    return `Removed ${queuedLine(removed, index)} from ${label}'s queue; ${left ? `${left} still queued` : "nothing else is queued"}.`;
  }
}
