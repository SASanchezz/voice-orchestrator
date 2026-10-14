import { z } from "zod";
import { numberOr } from "./yaml-values.js";

/** When a session's context or the money spent is shown as getting large; every threshold lives here. */
export const DEFAULT_BUDGET = {
  /** Percent of the context window: shown in amber from here. */
  contextWarnPercent: 60,
  /** Percent of the context window: shown in red and spoken once, with a handoff offered. */
  contextCriticalPercent: 80,
  /** USD one session may cost before it is marked. */
  sessionCostUsd: 5,
  /** USD all sessions together may cost in a day before it is marked. */
  dailyCostUsd: 25,
};

export const budgetSchema = z
  .object({
    contextWarnPercent: numberOr(DEFAULT_BUDGET.contextWarnPercent),
    contextCriticalPercent: numberOr(DEFAULT_BUDGET.contextCriticalPercent),
    sessionCostUsd: numberOr(DEFAULT_BUDGET.sessionCostUsd),
    dailyCostUsd: numberOr(DEFAULT_BUDGET.dailyCostUsd),
  })
  .nullish()
  .transform((budget) => budget ?? { ...DEFAULT_BUDGET });
export type BudgetConfig = z.infer<typeof budgetSchema>;
