import type { AppEvents, EventSubject } from "../events/app-events.js";
import type { TodoList } from "./todo-list.js";
import type { UsageLimitHit } from "./usage-limit.js";

/** The session whose task hit the limit, and the account it runs on. */
export interface LimitedSession extends EventSubject {
  sessionNumber: number;
  account: string;
}

/**
 * Tasks that fail on a usage limit are saved to the todo list instead of being retried.
 * Only the first failure of an account's limit episode is announced (a "usage_limit" event); later ones are saved quietly.
 * An episode ends when a task on that account succeeds, when you re-run saved tasks, or when the error names a new reset time.
 */
export class UsageLimits {
  /** Accounts in a limit episode, with the reset time their first failure named ("" if none). */
  private episodes = new Map<string, string>();

  constructor(
    private todo: TodoList,
    private events: AppEvents,
  ) {}

  /** Saves the session's failed task and everything queued behind it. */
  park(limited: LimitedSession, tasks: string[], hit: UsageLimitHit): void {
    const { project, sessionNumber, account } = limited;
    const savedAt = new Date().toISOString();
    for (const task of tasks)
      this.todo.save({ project, sessionNumber, account, savedAt, resetsAt: hit.resetsAt, task });
    if (this.isOngoing(account, hit)) return;
    this.episodes.set(account, hit.resetsAt ?? "");
    const { session, label } = limited;
    const savedTasks = this.todo.countFor(account);
    this.events.emitEvent({
      kind: "usage_limit",
      project,
      session,
      label,
      account,
      resetsAt: hit.resetsAt,
      savedTasks,
    });
  }

  /** The account works again (or you're retrying): its next limit failure is announced. */
  endEpisode(account: string): void {
    this.episodes.delete(account);
  }

  private isOngoing(account: string, hit: UsageLimitHit): boolean {
    const episodeReset = this.episodes.get(account);
    if (episodeReset === undefined) return false;
    return !hit.resetsAt || hit.resetsAt === episodeReset;
  }
}
