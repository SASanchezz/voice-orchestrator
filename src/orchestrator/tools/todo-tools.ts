import { z } from "zod";
import type { SavedTodo } from "../../limits/todo-file.js";
import { errorMessage } from "../../shared/errors.js";
import type { TodoRunner } from "../../workers/todo-runner.js";
import { defineTool, text, type OperatorTool } from "./tool-kit.js";

const TASK_CHARS = 300;

export function listTodo(todos: TodoRunner): OperatorTool {
  return defineTool({
    name: "list_todo",
    description:
      "Tasks saved to the todo list because their account hit a usage limit: id, project, session, account, when saved, when the limit resets, and the task.",
    args: {},
    run: () => text(todoListing(todos.saved())),
  });
}

export function runTodo(todos: TodoRunner): OperatorTool {
  return defineTool({
    name: "run_todo",
    description:
      "Run a saved todo task (or all of them) in its project's active session, like run_task, and take it off the list. Use after the limit has reset, when the user asks.",
    args: { id: z.string().describe('A todo id from list_todo, or "all"') },
    run: ({ id }) => text(runSaved(todos, id)),
  });
}

export function discardTodo(todos: TodoRunner): OperatorTool {
  return defineTool({
    name: "discard_todo",
    description: "Delete a saved todo task without running it, when the user asks.",
    args: { id: z.string().describe("A todo id from list_todo") },
    run: ({ id }) => text(todos.discard(id)),
  });
}

function todoListing(saved: SavedTodo[]): string {
  if (!saved.length) return "The todo list is empty.";
  return saved.map(todoLine).join("\n");
}

function todoLine(t: SavedTodo): string {
  const resets = t.resetsAt ? `, limit resets ${t.resetsAt}` : "";
  return `${t.id}: ${t.project} session ${t.sessionNumber}, ${t.account} account, saved ${t.savedAt}${resets}\n  ${t.task.slice(0, TASK_CHARS)}`;
}

function runSaved(todos: TodoRunner, id: string): string {
  const ids = id === "all" ? todos.saved().map((t) => t.id) : [id];
  if (!ids.length) return "The todo list is empty.";
  return ids.map((one) => runOne(todos, one)).join("\n");
}

/** One task that can't run (e.g. its folder is gone) doesn't stop the others; its reason is reported instead. */
function runOne(todos: TodoRunner, id: string): string {
  try {
    return todos.runSaved(id);
  } catch (error) {
    return errorMessage(error);
  }
}
