import { pickQueued, type QueuePick, queuedLine } from "./queue-pick.js";
import { withInstruction, withoutTask, withTaskFirst } from "./queue-edits.js";
import type { QueueItem } from "./queued-task.js";
import type { SessionQueue } from "./session-queue.js";
import type { WorkerDirectory } from "./worker-directory.js";

/** A queued task found by its id, at its place (from 0). */
interface PlacedItem {
  item: QueueItem;
  index: number;
}

/** A session's queued instructions: listed by place, and removed, edited or moved up one at a time. */
export class QueuedTasks {
  constructor(
    private queue: SessionQueue,
    private directory: WorkerDirectory,
  ) {}

  /** "webshop session 2 has 2 queued: #1 add tests; #2 fix the footer" */
  list(sessionId: string): string {
    const label = this.directory.labelOf(sessionId);
    const queued = this.instructionsOf(sessionId);
    if (!queued.length) return `${label} has nothing queued.`;
    const paused = this.queue.isPaused(sessionId) ? " (paused)" : "";
    return `${label} has ${queued.length} queued${paused}: ${queued.map(queuedLine).join("; ")}`;
  }

  /** The id of the task a spoken pick means; an error to read out if it means none or several. */
  idOf(sessionId: string, pick: QueuePick): string {
    const queued = this.instructionsOf(sessionId);
    if (!queued.length) throw new Error(`${this.directory.labelOf(sessionId)} has nothing queued.`);
    const item = this.queue.itemsOf(sessionId)[pickQueued(queued, pick)];
    if (!item) throw new Error("That task is no longer queued: it started or was removed.");
    return item.id;
  }

  remove(sessionId: string, taskId: string): string {
    const { item, index } = this.placed(sessionId, taskId);
    this.queue.replace(sessionId, withoutTask(this.queue.itemsOf(sessionId), taskId));
    const left = this.queue.itemsOf(sessionId).length;
    const rest = left ? `${left} still queued` : "nothing else is queued";
    return `Removed ${queuedLine(item.instruction, index)} from ${this.directory.labelOf(sessionId)}'s queue; ${rest}.`;
  }

  edit(sessionId: string, taskId: string, instruction: string): string {
    const { index } = this.placed(sessionId, taskId);
    this.queue.replace(sessionId, withInstruction(this.queue.itemsOf(sessionId), taskId, instruction));
    return `Changed ${queuedLine(instruction, index)} in ${this.directory.labelOf(sessionId)}'s queue.`;
  }

  moveToFront(sessionId: string, taskId: string): string {
    const { item } = this.placed(sessionId, taskId);
    this.queue.replace(sessionId, withTaskFirst(this.queue.itemsOf(sessionId), taskId));
    return `${queuedLine(item.instruction, 0)} runs next on ${this.directory.labelOf(sessionId)}.`;
  }

  private instructionsOf(sessionId: string): string[] {
    return this.queue.itemsOf(sessionId).map((item) => item.instruction);
  }

  /** An error once the task has started or was removed, so a stale click or edit changes nothing. */
  private placed(sessionId: string, taskId: string): PlacedItem {
    const index = this.queue.itemsOf(sessionId).findIndex((candidate) => candidate.id === taskId);
    const item = this.queue.itemsOf(sessionId)[index];
    if (!item) throw new Error("That task is no longer queued: it started or was removed.");
    return { item, index };
  }
}
