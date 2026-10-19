import { todoItemLabel } from "../../todo-items/todo-item-pick.js";
import { NO_PROJECT } from "../../todo-items/todo-item-schema.js";
import type { TodoItemSender } from "../../todo-items/todo-item-sender.js";
import type { TodoItems } from "../../todo-items/todo-items.js";
import type { TodoTrash } from "../../todo-items/todo-trash.js";
import type { ActionReporter } from "./action-reporter.js";
import { todoDoneBody, todoItemBody, type TodoItemBody } from "./todo-item-body.js";
import type { UiLookup } from "./ui-lookup.js";

/** What the timeline shows the page's to-do changes under. */
const ABOUT = "To-do";

/** Adding, editing and ticking items by click; each change is shown in the timeline and told to the model. */
export class TodoItemActions {
  constructor(
    private items: TodoItems,
    private lookup: UiLookup,
    private reporter: ActionReporter,
  ) {}

  add(body: unknown): string {
    const { project, ...draft } = this.parse(body);
    const item = this.items.add({ ...draft, project: project || undefined });
    return this.reporter.report(ABOUT, `Added to-do item ${todoItemLabel(item)}.`);
  }

  /** The form sends every field; project "" takes the item off its project. */
  edit(id: number, body: unknown): string {
    const item = this.items.edit(id, this.parse(body));
    return this.reporter.report(ABOUT, `Edited to-do item ${todoItemLabel(item)}.`);
  }

  setDone(id: number, body: unknown): string {
    const item = this.items.setDone(id, todoDoneBody.parse(body).done);
    return this.reporter.report(ABOUT, `${item.done ? "Ticked off" : "Reopened"} to-do item ${todoItemLabel(item)}.`);
  }

  private parse(body: unknown): TodoItemBody {
    const parsed = todoItemBody.parse(body);
    if (parsed.project !== NO_PROJECT) this.lookup.requireProject(parsed.project);
    return parsed;
  }
}

/** Deleting items by click, and the Undo that brings the last one back. */
export class TodoItemDeletions {
  constructor(
    private items: TodoItems,
    private trash: TodoTrash,
    private reporter: ActionReporter,
  ) {}

  remove(id: number): string {
    const item = this.items.find(id);
    this.trash.remove(item);
    return this.reporter.report(ABOUT, `Deleted to-do item ${todoItemLabel(item)}; Undo brings it back.`);
  }

  restore(id: number): string {
    const deleted = this.trash.deleted().find((item) => item.id === id);
    if (!deleted) throw new Error(`To-do item #${id} can no longer be restored.`);
    return this.reporter.report(ABOUT, `Restored to-do item ${todoItemLabel(this.trash.restore(deleted))}.`);
  }
}

/** Sending an item to its project's worker as a task, with one click. */
export class TodoItemSends {
  constructor(
    private items: TodoItems,
    private sender: TodoItemSender,
    private reporter: ActionReporter,
  ) {}

  send(id: number): string {
    const message = this.sender.send(id);
    const { project = "" } = this.items.find(id);
    return this.reporter.reportTask(project, this.sender.instructionFor(id), message);
  }
}
