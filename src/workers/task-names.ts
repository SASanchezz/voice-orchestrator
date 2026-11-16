import type { RunningTask } from "./running-task.js";
import type { TaskTopics } from "./task-topics.js";
import type { WorkerDirectory } from "./worker-directory.js";

/** How an ended task is named aloud: its session ("webshop session 2") and what its work was about. */
export class TaskNames {
  constructor(
    private directory: Pick<WorkerDirectory, "labelOf">,
    private topics: TaskTopics,
  ) {}

  labelOf(sessionId: string): string {
    return this.directory.labelOf(sessionId);
  }

  topicOf(task: RunningTask, closingNote: string): Promise<string | undefined> {
    return this.topics.topicOf(task, closingNote);
  }
}
