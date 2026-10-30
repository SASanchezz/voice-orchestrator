import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BUDGET } from "../config/budget-config.js";
import type { BudgetView, SessionView } from "./protocol.js";
import { contextLine, contextPercentText, sessionBudget } from "./session-budget.js";

const BUDGET: BudgetView = { ...DEFAULT_BUDGET, spentTodayUsd: 18.2 };

function session(parts: Partial<SessionView>): SessionView {
  return { id: "s1", number: 1, status: "idle", queued: [], costUsd: 0, history: [], ...parts };
}
const standingOf = (s: SessionView) => sessionBudget(s, BUDGET);

test("session budget: the context fill shows as a percent, also while it is low", () => {
  const s = session({ contextTokens: 50_000 });
  assert.equal(contextPercentText(s, standingOf(s)), "25%");
});

test("session budget: no context fill shows before a result reported it", () => {
  const s = session({});
  assert.equal(contextPercentText(s, standingOf(s)), "");
});

test("session budget: the critical level is reached from the critical percent", () => {
  assert.equal(sessionBudget(session({ contextTokens: 160_000 }), BUDGET).contextLevel, "critical");
});

test("session budget: the context line names tokens, window and percent", () => {
  const s = session({ contextTokens: 124_000 });
  assert.equal(contextLine(s, sessionBudget(s, BUDGET)), "Context 124k of 200k tokens (62%)");
});
