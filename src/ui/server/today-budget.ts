import type { DailySpend } from "../../budget/daily-spend.js";
import type { BudgetConfig } from "../../config/budget-config.js";
import type { BudgetView } from "../protocol.js";

/** The budget's limits, with what all workers spent today. */
export class TodayBudget {
  constructor(
    private limits: BudgetConfig,
    private spend: DailySpend,
  ) {}

  view(): BudgetView {
    return { ...this.limits, spentTodayUsd: this.spend.spentOn() };
  }
}
