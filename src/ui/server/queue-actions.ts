import type { QueuedTasks } from "../../workers/queued-tasks.js";
import type { ActionReporter } from "./action-reporter.js";
import { queueRemovalBody } from "./request-body.js";
import type { UiLookup } from "./ui-lookup.js";

/** Dropping one queued task by click; the running task and the rest of the queue keep going. */
export class QueueActions {
  constructor(
    private queuedTasks: QueuedTasks,
    private lookup: UiLookup,
    private reporter: ActionReporter,
  ) {}

  /** The page sends the place and the instruction it showed there, so a queue that moved on removes nothing. */
  removeQueued(sessionId: string, body: unknown): string {
    this.lookup.requireSession(sessionId);
    const { place, instruction } = queueRemovalBody.parse(body);
    const message = this.queuedTasks.remove(sessionId, { place, match: instruction });
    return this.reporter.report(this.lookup.labelOf(sessionId), message);
  }
}
