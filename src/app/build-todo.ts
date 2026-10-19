import { resolve } from "node:path";
import { STATE_DIR } from "../config/paths.js";
import { TodoItemFile } from "../todo-items/todo-item-file.js";
import { TodoItemSender } from "../todo-items/todo-item-sender.js";
import { TodoItems } from "../todo-items/todo-items.js";
import { TodoTrash } from "../todo-items/todo-trash.js";
import type { ActionReporter } from "../ui/server/action-reporter.js";
import { TodoItemActions, TodoItemDeletions, TodoItemSends } from "../ui/server/todo-item-actions.js";
import type { TodoItemHandlers } from "../ui/server/todo-item-routes.js";
import { TodoItemViews } from "../ui/server/todo-item-views.js";
import type { UiLookup } from "../ui/server/ui-lookup.js";
import type { TaskIntake } from "../workers/task-intake.js";

/** The user's personal to-do list, which the operator's tools and the web UI both change. */
export interface TodoParts {
  todoItems: TodoItems;
  todoTrash: TodoTrash;
  /** Hands an item to its project's worker. */
  todoSender: TodoItemSender;
}

export function buildTodo(intake: TaskIntake): TodoParts {
  const file = new TodoItemFile(resolve(STATE_DIR, "todo-items.json"));
  const todoItems = new TodoItems(file);
  return { todoItems, todoTrash: new TodoTrash(file), todoSender: new TodoItemSender(todoItems, intake) };
}

/** The page's view of the list. */
export function todoItemViews({ todoItems, todoTrash }: TodoParts): TodoItemViews {
  return new TodoItemViews(todoItems, todoTrash);
}

/** What the page's to-do clicks act on. */
export function todoItemHandlers(todo: TodoParts, lookup: UiLookup, reporter: ActionReporter): TodoItemHandlers {
  const { todoItems, todoTrash, todoSender } = todo;
  return {
    actions: new TodoItemActions(todoItems, lookup, reporter),
    deletions: new TodoItemDeletions(todoItems, todoTrash, reporter),
    sends: new TodoItemSends(todoItems, todoSender, reporter),
  };
}
