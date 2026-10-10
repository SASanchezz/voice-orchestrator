import type { Registry } from "./registry.js";
import type { SavedTodo, TodoList } from "./todo.js";

/** A task failed because its account is out of usage or spend, not because of the task itself. */
export interface UsageLimitHit {
  /** When the limit resets, as the error said it (e.g. "9pm (Europe/Warsaw)"). */
  resetsAt?: string;
}

const LIMIT_PATTERNS = [/spend limit/i, /usage limit/i, /session limit/i, /hit your .*limit/i, /limit reached/i];
const RESET_PATTERN = /\bresets\s+(?:at\s+)?([^·•\n]+)/i;

/** Reads a worker's error; undefined when it isn't a usage or spend limit. */
export function detectUsageLimit(error: string): UsageLimitHit | undefined {
  if (!LIMIT_PATTERNS.some((pattern) => pattern.test(error))) return undefined;
  const resetsAt = error.match(RESET_PATTERN)?.[1].trim().replace(/[.,;]+$/, "");
  return resetsAt ? { resetsAt } : {};
}

/** The one message for an account's limit episode, e.g. "prewins hit the work account limit; resets 9pm (Europe/Warsaw); 2 tasks saved to todo". */
export function usageLimitMessage(project: string, account: string, resetsAt: string | undefined, savedTasks: number): string {
  const resets = resetsAt ? `; resets ${resetsAt}` : "";
  return `${project} hit the ${account} account limit${resets}; ${savedTasks} task${savedTasks === 1 ? "" : "s"} saved to todo`;
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
    private registry: Registry,
  ) {}

  /** Saves the session's failed task and everything queued behind it. */
  park(sessionId: string, tasks: string[], hit: UsageLimitHit) {
    const { project, number: sessionNumber } = this.registry.session(sessionId);
    const account = this.registry.get(project).profile;
    const savedAt = new Date().toISOString();
    for (const task of tasks) this.todo.save({ project, sessionNumber, account, savedAt, resetsAt: hit.resetsAt, task });
    if (this.isOngoing(account, hit)) return;
    this.episodes.set(account, hit.resetsAt ?? "");
    this.registry.emitEvent({
      kind: "usage_limit",
      project,
      session: sessionId,
      label: this.registry.labelOf(sessionId),
      account,
      resetsAt: hit.resetsAt,
      savedTasks: this.todo.countFor(account),
    });
  }

  /** The account works again (or you're retrying): its next limit failure is announced. */
  endEpisode(account: string) {
    this.episodes.delete(account);
  }

  saved(): SavedTodo[] {
    return this.todo.list();
  }

  find(id: string): SavedTodo {
    return this.todo.find(id);
  }

  discard(id: string) {
    this.todo.remove(id);
  }

  private isOngoing(account: string, hit: UsageLimitHit): boolean {
    const episodeReset = this.episodes.get(account);
    if (episodeReset === undefined) return false;
    return !hit.resetsAt || hit.resetsAt === episodeReset;
  }
}
