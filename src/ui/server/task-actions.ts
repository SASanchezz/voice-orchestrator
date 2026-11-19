import type { QueuedTask } from "../../workers/queued-task.js";
import type { SessionInbox } from "../../workers/session-inbox.js";
import type { ActionReporter } from "./action-reporter.js";
import type { UiLookup } from "./ui-lookup.js";

/** A task typed straight to a session, without the assistant. */
export class TaskActions {
  constructor(
    private inbox: SessionInbox,
    private lookup: UiLookup,
    private reporter: ActionReporter,
  ) {}

  runTask(sessionId: string, task: QueuedTask): string {
    this.lookup.requireSession(sessionId);
    const about = this.lookup.labelOf(sessionId);
    const message = this.inbox.send(sessionId, task);
    return this.reporter.reportTask(about, task.instruction, message);
  }
}
