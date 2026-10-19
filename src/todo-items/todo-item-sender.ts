import { todoItemLabel } from "./todo-item-pick.js";
import type { TodoItem } from "./todo-item-schema.js";
import type { TodoItems } from "./todo-items.js";

/** Starts a task on a project's worker, or queues it; answers with what happened. See TaskIntake. */
export interface TaskStarter {
  run(project: string, instruction: string): string;
}

/** Hands an item to its project's worker as a task. The item stays open until you tick it off. */
export class TodoItemSender {
  constructor(
    private items: TodoItems,
    private tasks: TaskStarter,
  ) {}

  /** The item, as the instruction the worker was given. */
  instructionFor(id: number): string {
    return instructionOf(this.items.find(id));
  }

  send(id: number): string {
    const item = this.items.find(id);
    if (!item.project) throw new Error(`${todoItemLabel(item)} has no project. Set one first.`);
    return this.tasks.run(item.project, instructionOf(item));
  }
}

function instructionOf({ title, description }: TodoItem): string {
  return description ? `${title}\n\n${description}` : title;
}
