// How a session stands against the budget, as the page shows it. Imports only types, so the page compiles it too.

import {
  type BudgetLevel,
  contextLevel,
  contextPercentOf,
  DEFAULT_CONTEXT_WINDOW,
  thousands,
} from "../budget/budget-levels.js";
import type { BudgetView, SessionView } from "./protocol.js";

export interface SessionBudget {
  contextPercent: number;
  contextLevel: BudgetLevel;
  overCost: boolean;
}

export function sessionBudget(session: SessionView, budget: BudgetView): SessionBudget {
  const contextPercent = contextPercentOf(session);
  const level = contextLevel(contextPercent, budget);
  return { contextPercent, contextLevel: level, overCost: session.costUsd >= budget.sessionCostUsd };
}

/** The tab's badge: the context fill once it is high, the cost once it is over; nothing while all is fine. */
export function badgeText(session: SessionView, standing: SessionBudget): string {
  const parts = [
    standing.contextLevel === "ok" ? "" : `${standing.contextPercent}%`,
    standing.overCost ? usd(session.costUsd) : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

/** "Context 124k of 200k tokens (62%)" */
export function contextLine(session: SessionView, standing: SessionBudget): string {
  const window = session.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  return `Context ${thousands(session.contextTokens ?? 0)} of ${thousands(window)} tokens (${standing.contextPercent}%)`;
}

/** "$4.10 this session (limit $5)" */
export function sessionCostLine(session: SessionView, budget: BudgetView): string {
  return `${usd(session.costUsd)} this session (limit $${budget.sessionCostUsd})`;
}

/** "$18.20 today (limit $25)" */
export function todayLine(budget: BudgetView): string {
  return `${usd(budget.spentTodayUsd)} today (limit $${budget.dailyCostUsd})`;
}

export function isOverToday(budget: BudgetView): boolean {
  return budget.spentTodayUsd >= budget.dailyCostUsd;
}

function usd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
