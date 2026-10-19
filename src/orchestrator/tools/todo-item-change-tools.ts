import { z } from "zod";
import { pickTodoItem, todoItemLabel } from "../../todo-items/todo-item-pick.js";
import type { TodoItemSender } from "../../todo-items/todo-item-sender.js";
import type { TodoItems } from "../../todo-items/todo-items.js";
import type { TodoTrash } from "../../todo-items/todo-trash.js";
import { defineTool, text, type OperatorTool } from "./tool-kit.js";
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

export function sendTodoItem(items: TodoItems, sender: TodoItemSender): OperatorTool {
  return defineTool({
    name: "send_todo_item",
    description:
      "Send a to-do item to its project's worker as a task (its title and description), like run_task. The item stays open.",
    args: { item: todoItemArg },
    run: ({ item }) => text(sender.send(pickTodoItem(items.list(), item).id)),
  });
}
