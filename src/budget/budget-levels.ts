// How full a session's context is and whether spending is over its limit. Imports nothing, so the page compiles it too.

/** ok, then warn (shown in amber), then critical (shown in red, spoken once, a handoff offered). */
export type BudgetLevel = "ok" | "warn" | "critical";

export interface ContextThresholds {
  contextWarnPercent: number;
  contextCriticalPercent: number;
}

/** Until a worker's first result reports its model's window, the standard one is assumed. */
export const DEFAULT_CONTEXT_WINDOW = 200_000;

const PERCENT = 100;
const TOKENS_PER_K = 1000;
const LEVEL_RANK: Record<BudgetLevel, number> = { ok: 0, warn: 1, critical: 2 };

/** A session's context size as far as it is known. */
export interface ContextSize {
  contextTokens?: number;
  contextWindow?: number;
}

export function contextPercentOf({ contextTokens = 0, contextWindow = DEFAULT_CONTEXT_WINDOW }: ContextSize): number {
  return Math.round((contextTokens / contextWindow) * PERCENT);
}

export function contextLevel(percent: number, thresholds: ContextThresholds): BudgetLevel {
  if (percent >= thresholds.contextCriticalPercent) return "critical";
  return percent >= thresholds.contextWarnPercent ? "warn" : "ok";
}

export function isHigherLevel(level: BudgetLevel, than: BudgetLevel): boolean {
  return LEVEL_RANK[level] > LEVEL_RANK[than];
}

/** True only for the change that took spending from below `limit` to at or above it, so it is reported once. */
export function crossedLimit(before: number, after: number, limit: number): boolean {
  return before < limit && after >= limit;
}

/** "124k" */
export function thousands(tokens: number): string {
  return `${Math.round(tokens / TOKENS_PER_K)}k`;
}
