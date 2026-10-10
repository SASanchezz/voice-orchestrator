import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";

/** A task put aside to run later, e.g. because its account hit a usage limit. */
export interface TodoTask {
  project: string;
  sessionNumber: number;
  account: string;
  savedAt: string;
  /** When the limit resets, as the error said it (e.g. "9pm (Europe/Warsaw)"). */
  resetsAt?: string;
  task: string;
}

export interface SavedTodo extends TodoTask {
  /** The file name without its extension. */
  id: string;
}

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

/**
 * One Markdown file per task in a folder (state/todo/): the details in a short header, then the full task text.
 * Readable and editable by hand; deleting a file drops the task.
 */
export class TodoList {
  constructor(private dir: string) {}

  save(todo: TodoTask): SavedTodo {
    mkdirSync(this.dir, { recursive: true });
    const id = this.freeId(`${todo.savedAt.replace(/[-:]|\.\d+Z$/g, "").replace("T", "-")}-${slug(todo.project)}-s${todo.sessionNumber}`);
    const { task, ...details } = todo;
    writeFileSync(this.fileOf(id), `---\n${YAML.stringify(details).trimEnd()}\n---\n${task}\n`);
    return { id, ...todo };
  }

  /** Oldest first. */
  list(): SavedTodo[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter((name) => name.endsWith(".md"))
      .map((name) => name.slice(0, -".md".length))
      .sort() // ids, not file names: "x" before "x-2"
      .map((id) => this.read(id));
  }

  find(id: string): SavedTodo {
    if (!existsSync(this.fileOf(id))) throw new Error(`No todo task "${id}". Use list_todo for the ids.`);
    return this.read(id);
  }

  countFor(account: string): number {
    return this.list().filter((todo) => todo.account === account).length;
  }

  remove(id: string) {
    rmSync(this.fileOf(id), { force: true });
  }

  private read(id: string): SavedTodo {
    const match = readFileSync(this.fileOf(id), "utf8").match(FRONT_MATTER);
    if (!match) throw new Error(`Todo file ${id}.md has no "---" header.`);
    return { id, ...(YAML.parse(match[1]) as Omit<TodoTask, "task">), task: match[2].trimEnd() };
  }

  private freeId(base: string): string {
    let id = base;
    for (let n = 2; existsSync(this.fileOf(id)); n++) id = `${base}-${n}`;
    return id;
  }

  private fileOf(id: string): string {
    return resolve(this.dir, `${id}.md`);
  }
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
