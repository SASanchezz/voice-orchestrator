import type { TodoItemFile } from "./todo-item-file.js";
import { NO_PROJECT, type TodoChanges, type TodoDraft, type TodoItem } from "./todo-item-schema.js";

/** Your personal to-do list: items added, edited, ticked off and reopened, saved on every change. */
export class TodoItems {
  constructor(private file: TodoItemFile) {}

  /** Oldest first. */
  list(): TodoItem[] {
    return this.file.current.items;
  }

  find(id: number): TodoItem {
    const item = this.list().find((candidate) => candidate.id === id);
    if (!item) throw new Error(`There is no to-do item #${id}.`);
    return item;
  }

  add(draft: TodoDraft): TodoItem {
    const saved = this.file.current;
    const item: TodoItem = { ...draft, id: saved.nextId, done: false, createdAt: new Date().toISOString() };
    this.file.write({ ...saved, nextId: item.id + 1, items: [...saved.items, item] });
    return item;
  }

  edit(id: number, changes: TodoChanges): TodoItem {
    return this.replace(withChanges(this.find(id), changes));
  }

  setDone(id: number, done: boolean): TodoItem {
    return this.replace({ ...this.find(id), done });
  }

  private replace(item: TodoItem): TodoItem {
    const saved = this.file.current;
    this.file.write({ ...saved, items: saved.items.map((old) => (old.id === item.id ? item : old)) });
    return item;
  }
}

function withChanges(item: TodoItem, changes: TodoChanges): TodoItem {
  return {
    ...item,
    title: changes.title ?? item.title,
    description: changes.description ?? item.description,
    project: changes.project === NO_PROJECT ? undefined : (changes.project ?? item.project),
  };
}
