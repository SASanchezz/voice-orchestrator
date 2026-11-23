import type { QueuedTask } from "../../workers/queued-task.js";
import type { TaskActions } from "./task-actions.js";
import type { UiLookup } from "./ui-lookup.js";

/** Opens a new session of a project; it becomes the project's active one. */
export interface SessionOpener {
  createSession(project: string): { id: string };
}

/** A task that starts its own session, so it carries no earlier conversation and leaves the others' alone. */
export class FreshSessionTasks {
  constructor(
    private sessions: SessionOpener,
    private lookup: Pick<UiLookup, "requireProject">,
    private tasks: Pick<TaskActions, "runTask">,
  ) {}

  runInNewSession(project: string, task: QueuedTask): string {
    this.lookup.requireProject(project);
    const session = this.sessions.createSession(project);
    return this.tasks.runTask(session.id, task);
  }
}
