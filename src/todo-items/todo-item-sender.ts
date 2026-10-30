import { todoItemLabel } from "./todo-item-pick.js";
import type { TodoItem, TodoRun } from "./todo-item-schema.js";
import type { TodoItems } from "./todo-items.js";

/** Starts a task in a session, or queues it; answers with what happened. See TaskIntake. */
export interface TaskStarter {
  runInSession(sessionId: string, instruction: string): string;
}

/** The worker sessions an item can be sent to. */
export interface TaskSessions {
  activeSessionOf(project: string): string;
  /** Opens a fresh session in the project, so its task runs beside the project's busy ones; returns its id. */
  openSessionIn(project: string): string;
  projectOf(sessionId: string): string;
}

/**
 * Hands an item to a worker as a task: to its own project or any other, in a session of your choice, so one item can
 * run on several projects and several items on one project at once. The item stays open until you tick it off.
 */
export class TodoItemSender {
  constructor(
    private items: TodoItems,
    private tasks: TaskStarter,
    private sessions: TaskSessions,
  ) {}

  /** Where and as what the item was sent last. */
  lastRunOf(id: number): TodoRun {
    const run = this.items.find(id).runs.at(-1);
    if (!run) throw new Error(`To-do item #${id} was never sent.`);
    return run;
  }

  /** To the active session of the project given, or else of the item's own project. */
  send(id: number, project?: string): string {
    const item = this.items.find(id);
    return this.runIn(item, this.sessions.activeSessionOf(projectFor(item, project)));
  }

  sendToNewSession(id: number, project?: string): string {
    const item = this.items.find(id);
    return this.runIn(item, this.sessions.openSessionIn(projectFor(item, project)));
  }

  sendToSession(id: number, sessionId: string): string {
    return this.runIn(this.items.find(id), sessionId);
  }

  private runIn(item: TodoItem, sessionId: string): string {
    const instruction = instructionOf(item);
    const project = this.sessions.projectOf(sessionId);
    const started = this.tasks.runInSession(sessionId, instruction);
    this.items.addRun(item.id, { project, sessionId, instruction, sentAt: new Date().toISOString() });
    return started;
  }
}

function projectFor(item: TodoItem, project: string | undefined): string {
  const chosen = project ?? item.project;
  if (!chosen) throw new Error(`${todoItemLabel(item)} has no project. Set one first.`);
  return chosen;
}

function instructionOf({ title, description }: TodoItem): string {
  return description ? `${title}\n\n${description}` : title;
}
