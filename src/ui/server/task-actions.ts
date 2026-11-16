import type { QueuedTask } from "../../workers/queued-task.js";
import type { TaskIntake } from "../../workers/task-intake.js";
import type { ActionReporter } from "./action-reporter.js";
import type { UiLookup } from "./ui-lookup.js";

/** A task typed straight to a session, without the assistant. */
export class TaskActions {
  constructor(
    private intake: TaskIntake,
    private lookup: UiLookup,
    private reporter: ActionReporter,
  ) {}

  runTask(sessionId: string, { instruction, model }: QueuedTask): string {
    this.lookup.requireSession(sessionId);
    const about = this.lookup.labelOf(sessionId);
    const message = model
      ? this.intake.runOnModel(sessionId, instruction, model)
      : this.intake.runInSession(sessionId, instruction);
    return this.reporter.reportTask(about, instruction, message);
  }
}
