import type { QueuedTask } from "./queued-task.js";
import type { TaskRunner } from "./task-runner.js";
import type { WorkerChat } from "./worker-chat.js";
import type { WorkerDirectory } from "./worker-directory.js";
import { modelLabel } from "./worker-models.js";

/** Runs one of a session's tasks; it shows in the session's chat as it starts, not while it waits in the queue. */
export class TaskStarter {
  constructor(
    private directory: WorkerDirectory,
    private runner: Pick<TaskRunner, "run">,
    private chat: WorkerChat,
  ) {}

  run(sessionId: string, task: QueuedTask, abort: AbortController): Promise<void> {
    this.chat.say(sessionId, "task", task.instruction);
    if (task.model) this.chat.say(sessionId, "status", `This task runs on ${modelLabel(task.model)}.`);
    return this.runner.run(this.directory.newTask(sessionId, task), abort);
  }
}
