import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetFixture } from "./budget-fixture.js";

/** Just the fields the meter reads; the SDK's messages carry many more. */
function call(tokens: number, parent: string | null = null): object {
  const usage = { input_tokens: 10, cache_read_input_tokens: tokens - 10, cache_creation_input_tokens: 0 };
  return { type: "assistant", parent_tool_use_id: parent, message: { usage } };
}

function result(contextWindow: number): object {
  return { type: "result", modelUsage: { opus: { contextWindow } } };
}

test("context meter: the latest main-loop call's tokens are the session's context", () => {
  const { meter, sessions, sessionId } = budgetFixture();
  meter.record(sessionId, call(50_000));
  assert.equal(sessions.session(sessionId).contextTokens, 50_000);
});

test("context meter: a sub-agent's call doesn't count", () => {
  const { meter, sessions, sessionId } = budgetFixture();
  meter.record(sessionId, call(150_000, "tool-1"));
  assert.equal(sessions.session(sessionId).contextTokens, undefined);
});

test("context meter: a result reports the context window", () => {
  const { meter, sessions, sessionId } = budgetFixture();
  meter.record(sessionId, result(1_000_000));
  assert.equal(sessions.session(sessionId).contextWindow, 1_000_000);
});

test("context meter: reaching the warn level says so once in the session's chat", () => {
  const { meter, sessionId, said } = budgetFixture();
  meter.record(sessionId, call(124_000));
  meter.record(sessionId, call(130_000));
  assert.deepEqual(said, ["Context is 62% full; every further turn costs more."]);
});

test("context meter: the warn level is not spoken", () => {
  const { meter, sessionId, emitted } = budgetFixture();
  meter.record(sessionId, call(124_000));
  assert.deepEqual(emitted, []);
});

test("context meter: reaching the critical level emits one event to speak", () => {
  const { meter, sessionId, emitted } = budgetFixture();
  meter.record(sessionId, call(164_000));
  meter.record(sessionId, call(170_000));
  assert.deepEqual(
    emitted.map((e) => (e.kind === "context_full" ? e.percent : e.kind)),
    [82],
  );
});

test("context meter: after the context shrinks, crossing again alerts again", () => {
  const { meter, sessionId, emitted } = budgetFixture();
  meter.record(sessionId, call(164_000));
  meter.record(sessionId, call(40_000));
  meter.record(sessionId, call(165_000));
  assert.equal(emitted.length, 2);
});

test("context meter: a larger reported window lowers the level without an alert", () => {
  const { meter, sessionId, said } = budgetFixture();
  meter.record(sessionId, result(1_000_000));
  meter.record(sessionId, call(164_000));
  assert.deepEqual(said, []);
});
