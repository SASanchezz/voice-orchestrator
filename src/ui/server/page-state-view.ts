import type { DailySpend } from "../../budget/daily-spend.js";
import type { BudgetConfig } from "../../config/budget-config.js";
import type { UiState } from "../protocol.js";
import type { UiStateView } from "./ui-state-view.js";

/** The page's whole state: the live parts, and today's spending with the budget's limits. */
export class PageStateView {
  constructor(
    private live: UiStateView,
    private limits: BudgetConfig,
    private spend: DailySpend,
  ) {}

  state(): UiState {
    return { ...this.live.state(), budget: { ...this.limits, spentTodayUsd: this.spend.spentOn() } };
  }
}
