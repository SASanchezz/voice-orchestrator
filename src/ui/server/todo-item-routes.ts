import type { Route } from "./route-table.js";
import type { TodoItemActions, TodoItemDeletions, TodoItemSends } from "./todo-item-actions.js";

/** What the page's to-do actions act on. */
export interface TodoItemHandlers {
  actions: TodoItemActions;
  deletions: TodoItemDeletions;
  sends: TodoItemSends;
}

const id = (match: RegExpMatchArray): number => Number(match[1]);

/** The to-do list's routes; an item is addressed by its number. */
export function todoItemRoutes({ actions, deletions, sends }: TodoItemHandlers): [RegExp, Route][] {
  return [
    [/^\/api\/todo-items$/, (b) => actions.add(b)],
    [/^\/api\/todo-items\/(\d+)\/edit$/, (b, m) => actions.edit(id(m), b)],
    [/^\/api\/todo-items\/(\d+)\/done$/, (b, m) => actions.setDone(id(m), b)],
    [/^\/api\/todo-items\/(\d+)\/delete$/, (_b, m) => deletions.remove(id(m))],
    [/^\/api\/todo-items\/(\d+)\/restore$/, (_b, m) => deletions.restore(id(m))],
    [/^\/api\/todo-items\/(\d+)\/send$/, (_b, m) => sends.send(id(m))],
  ];
}
