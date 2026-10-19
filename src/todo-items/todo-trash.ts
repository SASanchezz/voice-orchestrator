import type { TodoItemFile } from "./todo-item-file.js";
import type { DeletedTodoItem, TodoItem } from "./todo-item-schema.js";

/** How many deleted items can still be restored. */
const KEPT_DELETED = 20;

/** Deleting items, and undoing that: a deleted item is kept a while and can come back as it was. */
export class TodoTrash {
  constructor(private file: TodoItemFile) {}

  /** Newest last. */
  deleted(): DeletedTodoItem[] {
    return this.file.current.deleted;
  }

  remove(item: TodoItem): void {
    const saved = this.file.current;
    const deleted = [...saved.deleted, { ...item, deletedAt: new Date().toISOString() }].slice(-KEPT_DELETED);
    this.file.write({ ...saved, items: saved.items.filter((kept) => kept.id !== item.id), deleted });
  }

  /** Puts a deleted item back under its own number, in its place by age. */
  restore(item: DeletedTodoItem): TodoItem {
    const saved = this.file.current;
    const { deletedAt: _deletedAt, ...restored } = item;
    const items = [...saved.items, restored].toSorted((a, b) => a.id - b.id);
    this.file.write({ ...saved, items, deleted: saved.deleted.filter((gone) => gone.id !== item.id) });
    return restored;
  }
}
