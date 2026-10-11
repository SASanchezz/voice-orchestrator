import type { SavedTodo } from "../limits/todo-file.js";
import type { TodoList } from "../limits/todo-list.js";
import type { UsageLimits } from "../limits/usage-limits.js";
import type { TaskIntake } from "./task-intake.js";

/** Tasks saved to the todo list because their account hit a usage limit: listed, run later, or dropped. */
export class TodoRunner {
  constructor(
    private todo: TodoList,
    private limits: UsageLimits,
    private intake: TaskIntake,
  ) {}

  /** Oldest first. */
  saved(): SavedTodo[] {
    return this.todo.list();
  }

  /** Runs a saved task in its project's active session and takes it off the todo list. */
  runSaved(id: string): string {
    const saved = this.todo.find(id);
    this.intake.checkSaved(saved);
    this.limits.endEpisode(saved.account); // a new limit failure is announced again
    const started = this.intake.run(saved.project, saved.task);
    this.todo.remove(id);
    return started;
  }

  discard(id: string): string {
    const saved = this.todo.find(id);
    this.todo.remove(id);
    return `Removed todo task ${id} (${saved.project}).`;
  }
}
