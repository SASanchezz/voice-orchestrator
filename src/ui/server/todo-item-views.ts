import type { TodoItems } from "../../todo-items/todo-items.js";
import type { TodoTrash } from "../../todo-items/todo-trash.js";
import type { TodoItemView, TodoListView } from "../protocol.js";

/** Your to-do list as the page shows it, with the item an Undo would bring back. */
export class TodoItemViews {
  constructor(
    private items: TodoItems,
    private trash: TodoTrash,
  ) {}

  view(): TodoListView {
    const deleted = this.trash.deleted().at(-1);
    const lastDeleted = deleted && itemView(deleted);
    return { items: this.items.list().map(itemView), ...(lastDeleted && { lastDeleted }) };
  }
}

function itemView({ id, title, description, project, done, createdAt }: TodoItemView): TodoItemView {
  return { id, title, description, ...(project && { project }), done, createdAt };
}
