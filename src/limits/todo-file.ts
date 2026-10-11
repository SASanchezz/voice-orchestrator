import YAML from "yaml";
import { z } from "zod";

// A todo file: the task's details as YAML between "---" lines, then the full task text.

const detailsSchema = z.object({
  project: z.string(),
  sessionNumber: z.number(),
  account: z.string(),
  savedAt: z.string(),
  /** When the limit resets, as the error said it (e.g. "9pm (Europe/Warsaw)"). */
  resetsAt: z.string().optional(),
});

/** A task put aside to run later, e.g. because its account hit a usage limit. */
export type TodoTask = z.infer<typeof detailsSchema> & { task: string };

export interface SavedTodo extends TodoTask {
  /** The file name without its extension. */
  id: string;
}

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

/** Says when and where the task was saved, e.g. "20261010-180431-web-shop-s3". */
export function todoId(todo: TodoTask): string {
  const when = todo.savedAt.replace(/[-:]|\.\d+Z$/g, "").replace("T", "-");
  return `${when}-${slug(todo.project)}-s${todo.sessionNumber}`;
}

export function formatTodo(todo: TodoTask): string {
  const { task, ...details } = todo;
  return `---\n${YAML.stringify(details).trimEnd()}\n---\n${task}\n`;
}

export function parseTodo(id: string, text: string): SavedTodo {
  const match = text.match(FRONT_MATTER);
  if (!match) throw new Error(`Todo file ${id}.md has no "---" header.`);
  return { id, ...detailsSchema.parse(YAML.parse(match[1])), task: match[2].trimEnd() };
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
