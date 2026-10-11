import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatTodo, parseTodo, todoId, type SavedTodo, type TodoTask } from "./todo-file.js";

const EXTENSION = ".md";

/**
 * One Markdown file per task in a folder (state/todo/): the details in a short header, then the full task text.
 * Readable and editable by hand; deleting a file drops the task.
 */
export class TodoList {
  constructor(private dir: string) {}

  save(todo: TodoTask): SavedTodo {
    mkdirSync(this.dir, { recursive: true });
    const id = this.freeId(todoId(todo));
    writeFileSync(this.fileOf(id), formatTodo(todo));
    return { id, ...todo };
  }

  /** Oldest first. */
  list(): SavedTodo[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter((name) => name.endsWith(EXTENSION))
      .map((name) => name.slice(0, -EXTENSION.length))
      .toSorted() // ids, not file names: "x" before "x-2"
      .map((id) => this.read(id));
  }

  find(id: string): SavedTodo {
    if (!existsSync(this.fileOf(id))) throw new Error(`No todo task "${id}". Use list_todo for the ids.`);
    return this.read(id);
  }

  countFor(account: string): number {
    return this.list().filter((todo) => todo.account === account).length;
  }

  remove(id: string): void {
    rmSync(this.fileOf(id), { force: true });
  }

  private read(id: string): SavedTodo {
    return parseTodo(id, readFileSync(this.fileOf(id), "utf8"));
  }

  private freeId(base: string): string {
    let id = base;
    for (let n = 2; existsSync(this.fileOf(id)); n++) id = `${base}-${n}`;
    return id;
  }

  private fileOf(id: string): string {
    return resolve(this.dir, `${id}${EXTENSION}`);
  }
}
