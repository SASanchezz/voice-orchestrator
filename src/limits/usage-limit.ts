import type { UsageLimitEvent } from "../events/app-events.js";

type UsageLimitNotice = Pick<UsageLimitEvent, "project" | "account" | "resetsAt" | "savedTasks">;

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
  const resetsAt = error
    .match(RESET_PATTERN)?.[1]
    .trim()
    .replace(/[.,;]+$/, "");
  return resetsAt ? { resetsAt } : {};
}

/** The one message for an account's limit episode, e.g. "prewins hit the work account limit; resets 9pm (Europe/Warsaw); 2 tasks saved to todo". */
export function usageLimitMessage(limit: UsageLimitNotice): string {
  const { project, account, resetsAt, savedTasks } = limit;
  const resets = resetsAt ? `; resets ${resetsAt}` : "";
  return `${project} hit the ${account} account limit${resets}; ${savedTasks} task${savedTasks === 1 ? "" : "s"} saved to todo`;
}
