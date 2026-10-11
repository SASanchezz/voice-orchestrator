import { errorMessage } from "../shared/errors.js";
import type { RunningTask } from "./running-task.js";
import type { TaskLauncher } from "./task-launcher.js";
import type { TaskOutcomes } from "./task-outcomes.js";
import { isFailedResult, type TaskStream } from "./task-stream.js";

/** Runs one task to its end: done, failed, or stopped by you. */
export class TaskRunner {
  constructor(
    private launcher: TaskLauncher,
    private stream: TaskStream,
    private outcomes: TaskOutcomes,
  ) {}

  async run(task: RunningTask, abort: AbortController): Promise<void> {
    this.outcomes.started(task);
    let failureReported = false;
    try {
      for await (const msg of this.launcher.launch(task, abort)) {
        this.stream.handle(task, msg);
        failureReported ||= isFailedResult(msg);
      }
    } catch (e) {
      if (abort.signal.aborted) this.outcomes.stopped(task);
      else if (!failureReported) this.outcomes.failed(task, errorMessage(e)); // else Claude Code repeating the error result it just sent
    }
  }
}
