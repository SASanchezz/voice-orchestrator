import { z } from "zod";
import type { AppConfig } from "../../config/app-config.js";
import { pickTodoItem, todoItemLabel } from "../../todo-items/todo-item-pick.js";
import { NO_PROJECT, type TodoItem } from "../../todo-items/todo-item-schema.js";
import type { TodoItems } from "../../todo-items/todo-items.js";
import { defineTool, needProject, text, type OperatorTool } from "./tool-kit.js";

/** Clears an item's project when said as the project. */
const NONE = "none";
const SHOWN = ["open", "done", "all"] as const;

export const todoItemArg = z.string().describe("The item's number from list_todo_items, or words from its title");
const titleArg = z.string().trim().min(1).describe("A short title, at most about eight words");
const descriptionArg = z
  .string()
  .describe("One to three sentences: what needs doing, with any detail needed to act on it later");

export function listTodoItems(items: TodoItems): OperatorTool {
  return defineTool({
    name: "list_todo_items",
    description:
      "The user's personal to-do list: number, title, project, status, when added, and description. Open items by default.",
    args: { show: z.enum(SHOWN).optional().describe("open (default), done, or all") },
    run: ({ show = "open" }) => text(todoListing(items.list().filter((item) => isShown(item, show)))),
  });
}

export function addTodoItem(items: TodoItems, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "add_todo_item",
    description: "Add an item to the user's personal to-do list.",
    args: {
      title: titleArg,
      description: descriptionArg,
      project: z.string().optional().describe("The project it belongs to, if it clearly belongs to one"),
    },
    run: ({ title, description, project }) => {
      const item = items.add({ title, description, project: project ? needProject(cfg, project) : undefined });
      return text(`Added ${todoItemLabel(item)}.`);
    },
  });
}

export function editTodoItem(items: TodoItems, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "edit_todo_item",
    description: "Change a to-do item's title, description or project. Only what you pass changes.",
    args: {
      item: todoItemArg,
      title: titleArg.optional(),
      description: descriptionArg.optional(),
      project: z.string().optional().describe(`Move it to this project, or "${NONE}" to take it off its project`),
    },
    run: ({ item, title, description, project }) => {
      const { id } = pickTodoItem(items.list(), item);
      const changed = items.edit(id, { title, description, project: project ? projectOf(cfg, project) : undefined });
      return text(`Updated ${todoItemLabel(changed)}: ${changed.description || "no description"}`);
    },
  });
}

function projectOf(cfg: AppConfig, spoken: string): string {
  return spoken.trim().toLowerCase() === NONE ? NO_PROJECT : needProject(cfg, spoken);
}

function isShown(item: TodoItem, show: (typeof SHOWN)[number]): boolean {
  if (show === "all") return true;
  return item.done === (show === "done");
}

function todoListing(shown: TodoItem[]): string {
  if (!shown.length) return "No such items on the to-do list.";
  return shown.map(todoItemEntry).join("\n");
}

function todoItemEntry(item: TodoItem): string {
  const added = new Date(item.createdAt).toLocaleString();
  const head = `${todoItemLabel(item)} [${item.done ? "done" : "open"}], added ${added}`;
  return item.description ? `${head}\n  ${item.description}` : head;
}
