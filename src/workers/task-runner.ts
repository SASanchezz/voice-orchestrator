import type { SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { errorMessage } from "../shared/errors.js";
import type { RunningTask } from "./running-task.js";
import type { TaskLauncher } from "./task-launcher.js";
import type { TaskOutcomes } from "./task-outcomes.js";
import { isFailedResult, type TaskStream } from "./task-stream.js";

/** Runs one task to its end: done, failed, or stopped by you. Each task ends exactly once. */
export class TaskRunner {
  constructor(
    private launcher: Pick<TaskLauncher, "launch">,
    private stream: Pick<TaskStream, "handle" | "finish">,
    private outcomes: Pick<TaskOutcomes, "started" | "stopped" | "failed">,
  ) {}

  async run(task: RunningTask, abort: AbortController): Promise<void> {
    this.outcomes.started(task);
    let lastResult: SDKResultMessage | undefined;
    try {
      for await (const msg of this.launcher.launch(task, abort)) {
        this.stream.handle(task, msg);
        if (msg.type === "result") lastResult = msg;
      }
      if (lastResult) this.stream.finish(task, lastResult);
    } catch (e) {
      if (abort.signal.aborted) this.outcomes.stopped(task);
      else if (lastResult && isFailedResult(lastResult))
        this.stream.finish(task, lastResult); // Claude Code throws the error result it just sent
      else this.outcomes.failed(task, errorMessage(e));
    }
  }
}
