import { test } from "node:test";
import assert from "node:assert/strict";
import type { QueryFn } from "../agent/query-fn.js";
import { type BudgetFixture, budgetFixture } from "../budget/budget-fixture.js";
import { fakeQuery, type QueryCall } from "../testing/fake-query.js";
import { compactCommand, ContextCompactor } from "./context-compactor.js";

const CONVERSATION = "claude-1";
const BOUNDARY = {
  type: "system",
  subtype: "compact_boundary",
  compact_metadata: { pre_tokens: 160_000, post_tokens: 9_000 },
};
const RESULT = { type: "result", subtype: "success", is_error: false, result: "", session_id: CONVERSATION };
const NOTHING_TO_CUT = { ...RESULT, result: "Not enough messages to compact." };

interface Compacting {
  compactor: ContextCompactor;
  budget: BudgetFixture;
  calls: QueryCall[];
}

function compactingWith(...messages: object[]): Compacting {
  const calls: QueryCall[] = [];
  const query: QueryFn = fakeQuery((call) => {
    calls.push(call);
    return (async function* () {
      yield* messages;
    })();
  });
  const budget = budgetFixture();
  budget.sessions.updateSession(budget.sessionId, { claudeSessionId: CONVERSATION });
  const options = { forProject: () => ({ cwd: "/code/webshop" }) };
  return { compactor: new ContextCompactor(options, query, budget.ledger), budget, calls };
}

function compact({ compactor, budget }: Compacting): ReturnType<ContextCompactor["compact"]> {
  const session = budget.sessions.session(budget.sessionId);
  return compactor.compact(session, compactCommand(), new AbortController());
}

test("context compactor: resumes the session's own conversation, without forking it", async () => {
  const compacting = compactingWith(BOUNDARY, { ...RESULT, total_cost_usd: 0 });
  await compact(compacting);
  const { resume, forkSession } = compacting.calls[0].options ?? {};
  assert.deepEqual({ resume, forkSession }, { resume: CONVERSATION, forkSession: undefined });
});

test("context compactor: sends Claude Code's /compact", async () => {
  const compacting = compactingWith(BOUNDARY, { ...RESULT, total_cost_usd: 0 });
  await compact(compacting);
  assert.equal(compacting.calls[0].prompt, "/compact");
});

test("context compactor: reports the conversation's size before and after", async () => {
  const shrink = await compact(compactingWith(BOUNDARY, { ...RESULT, total_cost_usd: 0 }));
  assert.deepEqual(shrink, { conversationId: CONVERSATION, tokensBefore: 160_000, tokensAfter: 9_000 });
});

test("context compactor: the cost is the session's", async () => {
  const compacting = compactingWith(BOUNDARY, { ...RESULT, total_cost_usd: 0.4 });
  await compact(compacting);
  assert.equal(compacting.budget.sessions.session(compacting.budget.sessionId).costUsd, 0.4);
});

test("context compactor: a run that cut nothing fails with Claude Code's reason", async () => {
  await assert.rejects(compact(compactingWith({ ...NOTHING_TO_CUT, total_cost_usd: 0 })), /Not enough messages/);
});

test("compact command: carries what the summary should keep", () => {
  assert.equal(compactCommand("the failing checkout test"), "/compact the failing checkout test");
});
