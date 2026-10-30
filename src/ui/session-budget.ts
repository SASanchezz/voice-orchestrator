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
}

export function sessionBudget(session: SessionView, budget: BudgetView): SessionBudget {
  const contextPercent = contextPercentOf(session);
  return { contextPercent, contextLevel: contextLevel(contextPercent, budget) };
}

/** "62%": how full the context is, once a result reported it. */
export function contextPercentText(session: SessionView, standing: SessionBudget): string {
  return session.contextTokens === undefined ? "" : `${standing.contextPercent}%`;
}

/** "Context 124k of 200k tokens (62%)" */
export function contextLine(session: SessionView, standing: SessionBudget): string {
  const window = session.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
  return `Context ${thousands(session.contextTokens ?? 0)} of ${thousands(window)} tokens (${standing.contextPercent}%)`;
}
