import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BUDGET } from "../config/budget-config.js";
import type { BudgetView, SessionView } from "./protocol.js";
import { badgeText, contextLine, isOverToday, sessionBudget, todayLine } from "./session-budget.js";

const BUDGET: BudgetView = { ...DEFAULT_BUDGET, spentTodayUsd: 18.2 };

function session(parts: Partial<SessionView>): SessionView {
  return { id: "s1", number: 1, status: "idle", queued: [], costUsd: 0, history: [], ...parts };
}
const badgeOf = (s: SessionView) => badgeText(s, sessionBudget(s, BUDGET));

test("session budget: a small, cheap session has no badge", () => {
  assert.equal(badgeOf(session({ contextTokens: 50_000, costUsd: 1 })), "");
});

test("session budget: a high context shows its percent", () => {
  assert.equal(badgeOf(session({ contextTokens: 124_000 })), "62%");
});

test("session budget: a session over its cost limit shows its cost", () => {
  assert.equal(badgeOf(session({ costUsd: 5.25 })), "$5.25");
});

test("session budget: the critical level is reached from the critical percent", () => {
  assert.equal(sessionBudget(session({ contextTokens: 160_000 }), BUDGET).contextLevel, "critical");
});

test("session budget: the context line names tokens, window and percent", () => {
  const s = session({ contextTokens: 124_000 });
  assert.equal(contextLine(s, sessionBudget(s, BUDGET)), "Context 124k of 200k tokens (62%)");
});

test("session budget: today's line shows the spend and the limit", () => {
  assert.equal(todayLine(BUDGET), "$18.20 today (limit $25)");
});

test("session budget: today is over once the daily limit is reached", () => {
  assert.equal(isOverToday({ ...BUDGET, spentTodayUsd: 25 }), true);
});
