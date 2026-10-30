import { z } from "zod";
import type { AppConfig } from "../../config/app-config.js";
import { pickTodoItem, todoItemLabel } from "../../todo-items/todo-item-pick.js";
import type { TodoItemSender } from "../../todo-items/todo-item-sender.js";
import type { TodoItems } from "../../todo-items/todo-items.js";
import type { TodoTrash } from "../../todo-items/todo-trash.js";
import { defineTool, needProject, text, type OperatorTool } from "./tool-kit.js";
import { todoItemArg } from "./todo-item-tools.js";

export function setTodoItemDone(items: TodoItems): OperatorTool {
  return defineTool({
    name: "set_todo_item_done",
    description: "Tick a to-do item off as done, or reopen it.",
    args: { item: todoItemArg, done: z.boolean().describe("true: done; false: open again") },
    run: ({ item, done }) => {
      const changed = items.setDone(pickTodoItem(items.list(), item).id, done);
      return text(`${done ? "Done" : "Reopened"}: ${todoItemLabel(changed)}.`);
    },
  });
}

export function deleteTodoItem(items: TodoItems, trash: TodoTrash): OperatorTool {
  return defineTool({
    name: "delete_todo_item",
    description: "Delete a to-do item. It can be brought back with restore_todo_item.",
    args: { item: todoItemArg },
    run: ({ item }) => {
      const deleted = pickTodoItem(items.list(), item);
      trash.remove(deleted);
      const description = deleted.description ? `: ${deleted.description}` : "";
      return text(`Deleted ${todoItemLabel(deleted)}${description}. restore_todo_item brings it back.`);
    },
  });
}

export function restoreTodoItem(trash: TodoTrash): OperatorTool {
  return defineTool({
    name: "restore_todo_item",
    description: "Undo the deletion of a to-do item: the last one deleted, or the one named.",
    args: { item: todoItemArg.optional().describe("Its number or words from it; the last deleted if left out") },
    run: ({ item }) => {
      const deleted = trash.deleted();
      const meant = item ? pickTodoItem(deleted, item) : deleted.at(-1);
      if (!meant) throw new Error("No deleted to-do item to restore.");
      return text(`Restored ${todoItemLabel(trash.restore(meant))}.`);
    },
  });
}

const sendArgs = {
  item: todoItemArg,
  project: z.string().optional().describe("The project to run it on; the item's own project if left out"),
  newSession: z
    .boolean()
    .optional()
    .describe("true: open a new session for it, so it runs beside the project's busy session instead of queueing"),
};

export function sendTodoItem(items: TodoItems, sender: TodoItemSender, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "send_todo_item",
    description:
      "Send a to-do item to a project's worker as a task (its title and description), like run_task. The item stays open. " +
      "It may run on several projects, and several items on one project, each in its own session.",
    args: sendArgs,
    run: ({ item, project, newSession }) => {
      const { id } = pickTodoItem(items.list(), item);
      const chosen = project && needProject(cfg, project);
      return text(newSession ? sender.sendToNewSession(id, chosen) : sender.send(id, chosen));
    },
  });
}
