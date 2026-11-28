import type { QueueControl } from "../../workers/queue-control.js";
import type { QueuedTasks } from "../../workers/queued-tasks.js";
import type { ActionReporter } from "./action-reporter.js";
import { queueEditBody } from "./request-body.js";
import type { UiLookup } from "./ui-lookup.js";

/** A session's queue as its strip changes it: its tasks one by one, or the whole queue when paused. */
interface QueueParts {
  tasks: QueuedTasks;
  control: QueueControl;
}

/** The queue strip's buttons; each acts on one session's queue, the running task keeps going. */
export class QueueActions {
  constructor(
    private queue: QueueParts,
    private lookup: UiLookup,
    private reporter: ActionReporter,
  ) {}

  /** By id, so a task that started or was removed meanwhile changes nothing. */
  remove(sessionId: string, taskId: string): string {
    return this.reported(sessionId, () => this.queue.tasks.remove(sessionId, taskId));
  }

  edit(sessionId: string, taskId: string, body: unknown): string {
    const { instruction } = queueEditBody.parse(body);
    return this.reported(sessionId, () => this.queue.tasks.edit(sessionId, taskId, instruction));
  }

  runNext(sessionId: string, taskId: string): string {
    return this.reported(sessionId, () => this.queue.tasks.moveToFront(sessionId, taskId));
  }

  resume(sessionId: string): string {
    return this.reported(sessionId, () => this.queue.control.resume(sessionId));
  }

  clear(sessionId: string): string {
    return this.reported(sessionId, () => this.queue.control.clear(sessionId));
  }

  private reported(sessionId: string, act: () => string): string {
    this.lookup.requireSession(sessionId);
    return this.reporter.report(this.lookup.labelOf(sessionId), act());
  }
}
