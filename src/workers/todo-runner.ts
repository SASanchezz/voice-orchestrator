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
    return this.runIn(saved, () => this.intake.run(saved.project, saved.task));
  }

  /** Runs a saved task in the session given, as `instruction`, and takes it off the todo list. */
  resume(saved: SavedTodo, sessionId: string, instruction: string): string {
    return this.runIn(saved, () => this.intake.runInSession(sessionId, instruction));
  }

  private runIn(saved: SavedTodo, start: () => string): string {
    this.intake.checkSaved(saved);
    this.limits.endEpisode(saved.account); // a new limit failure is announced again
    const started = start();
    this.todo.remove(saved.id);
    return started;
  }

  discard(id: string): string {
    const saved = this.todo.find(id);
    this.todo.remove(id);
    return `Removed todo task ${id} (${saved.project}).`;
  }
}
