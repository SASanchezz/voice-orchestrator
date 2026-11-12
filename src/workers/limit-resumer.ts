import type { ResumePolicy } from "../limits/resume-policy.js";
import type { SavedTodo } from "../limits/todo-file.js";
import { errorMessage } from "../shared/errors.js";
import type { QuietResume } from "./quiet-resume.js";

/** The todo list's saved tasks, as the resumer reads them. */
export interface SavedTasks {
  saved(): SavedTodo[];
}

/** Checks every few minutes for tasks whose usage limit has reset, and runs them again, quietly. */
export class LimitResumer {
  constructor(
    private todos: SavedTasks,
    private policy: ResumePolicy,
    private quietResume: QuietResume,
  ) {}

  start(): void {
    setInterval(() => this.resumeDue(new Date()), this.policy.checkEveryMs).unref();
    this.resumeDue(new Date());
  }

  /** Oldest first, so a session's cut-off task starts and the ones queued behind it queue again in their order. */
  resumeDue(now: Date): void {
    for (const saved of this.policy.due(this.todos.saved(), now)) this.resumeOrKeep(saved);
  }

  /** A task that can't run now (its project or folder is gone) stays on the list for you. */
  private resumeOrKeep(saved: SavedTodo): void {
    try {
      console.log(`[limits] resumed todo ${saved.id}: ${this.quietResume.resume(saved)}`);
    } catch (error) {
      console.error(`[limits] todo ${saved.id} not resumed: ${errorMessage(error)}`);
    }
  }
}
