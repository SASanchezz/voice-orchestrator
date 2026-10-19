import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { errorMessage } from "../shared/errors.js";
import { EMPTY_TODO_FILE, todoFileSchema, type TodoFile } from "./todo-item-schema.js";

/** state/todo-items.json, read once and written on every change, so the list survives restarts. */
export class TodoItemFile {
  private saved: TodoFile;

  constructor(private file: string) {
    this.saved = existsSync(file) ? readTodoFile(file) : EMPTY_TODO_FILE;
  }

  get current(): TodoFile {
    return this.saved;
  }

  write(next: TodoFile): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, `${JSON.stringify(next, null, 2)}\n`);
    this.saved = next;
  }
}

/** A damaged file stops the app rather than being overwritten with an empty list. */
function readTodoFile(file: string): TodoFile {
  try {
    return todoFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  } catch (error) {
    throw new Error(`${file} can't be read (${errorMessage(error)}). Fix it or move it away.`, { cause: error });
  }
}
