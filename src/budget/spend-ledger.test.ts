import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetFixture } from "./budget-fixture.js";

test("spend ledger: what a session spends counts toward today", () => {
  const { ledger, sessionId, daily } = budgetFixture();
  ledger.charge(sessionId, 1);
  ledger.charge(sessionId, 1.5);
  assert.equal(daily.spentOn(), 1.5);
});

test("spend ledger: a fork's spend counts, but the conversation's own total stays", () => {
  const { ledger, sessions, sessionId } = budgetFixture();
  ledger.charge(sessionId, 2);
  ledger.chargeFork(sessionId, 2.5);
  ledger.charge(sessionId, 3);
  assert.equal(sessions.session(sessionId).costUsd, 3.5);
});

test("spend ledger: going over the session limit is said once in its chat", () => {
  const { ledger, sessionId, said } = budgetFixture();
  ledger.charge(sessionId, 4);
  ledger.charge(sessionId, 6);
  ledger.charge(sessionId, 7);
  assert.deepEqual(said, ["This session has now cost over its $5 limit."]);
});

test("spend ledger: going over the daily limit is said once", () => {
  const { ledger, sessionId, said } = budgetFixture();
  ledger.charge(sessionId, 26);
  ledger.charge(sessionId, 27);
  assert.equal(said.filter((line) => line.startsWith("Today's spend")).length, 1);
});
