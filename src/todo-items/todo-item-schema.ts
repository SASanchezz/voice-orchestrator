import { z } from "zod";

/** What a new item is made of: a title, a short description, and the project it belongs to, if any. */
export const todoDraftSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim(),
  project: z.string().optional(),
});
export type TodoDraft = z.infer<typeof todoDraftSchema>;

/** Clears an item's project in an edit. */
export const NO_PROJECT = "";

/** An edit: only the fields given change; `project: NO_PROJECT` takes the item off its project. */
export type TodoChanges = Partial<TodoDraft>;

const todoItemSchema = todoDraftSchema.extend({
  id: z.number().int().positive(),
  done: z.boolean(),
  /** ISO time. */
  createdAt: z.string(),
});
export type TodoItem = z.infer<typeof todoItemSchema>;

const deletedTodoItemSchema = todoItemSchema.extend({ deletedAt: z.string() });
export type DeletedTodoItem = z.infer<typeof deletedTodoItemSchema>;

/** state/todo-items.json. */
export const todoFileSchema = z.object({
  nextId: z.number().int().positive(),
  /** Oldest first. */
  items: z.array(todoItemSchema),
  /** The last few deleted items, newest last, so a deletion can be undone. */
  deleted: z.array(deletedTodoItemSchema),
});
export type TodoFile = z.infer<typeof todoFileSchema>;

export const EMPTY_TODO_FILE: TodoFile = { nextId: 1, items: [], deleted: [] };
