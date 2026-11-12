import type { QuietSessions } from "../events/quiet-sessions.js";
import type { SavedTodo } from "../limits/todo-file.js";
import type { Registry } from "../registry/registry.js";
import type { TodoRunner } from "./todo-runner.js";

/** The worker sessions a resumed task can go back to. */
export type ResumeSessions = Pick<Registry, "activeSession" | "sessionByNumber" | "hasSessionNumbered">;

/**
 * Runs a task saved by a usage limit again, in the session it was cut off in (whose conversation holds what it
 * already did), or the project's active one if that session was closed. The session is kept quiet until you are back.
 */
export class QuietResume {
  constructor(
    private todos: Pick<TodoRunner, "resume">,
    private sessions: ResumeSessions,
    private quiet: QuietSessions,
  ) {}

  resume(saved: SavedTodo): string {
    const sessionId = this.sessionFor(saved);
    this.quiet.keepQuiet(sessionId);
    return this.todos.resume(saved, sessionId, resumedInstruction(saved.task));
  }

  private sessionFor({ project, sessionNumber }: SavedTodo): string {
    const isOpen = this.sessions.hasSessionNumbered(project, sessionNumber);
    if (isOpen) return this.sessions.sessionByNumber(project, sessionNumber).id;
    return this.sessions.activeSession(project).id;
  }
}

function resumedInstruction(task: string): string {
  return `This task stopped when the account hit its usage limit, which has now reset. Part of it may already be done in this conversation: check what is done and continue from there.\n\n${task}`;
}
