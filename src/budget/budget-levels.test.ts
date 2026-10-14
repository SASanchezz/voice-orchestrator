import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BUDGET } from "../config/budget-config.js";
import { contextLevel, contextPercentOf, crossedLimit, isHigherLevel } from "./budget-levels.js";

test("budget levels: below the warn percent is ok", () => {
  assert.equal(contextLevel(59, DEFAULT_BUDGET), "ok");
});

test("budget levels: from the warn percent it is warn", () => {
  assert.equal(contextLevel(60, DEFAULT_BUDGET), "warn");
});

test("budget levels: from the critical percent it is critical", () => {
  assert.equal(contextLevel(80, DEFAULT_BUDGET), "critical");
});

test("budget levels: the standard window is assumed until a result reports one", () => {
  assert.equal(contextPercentOf({ contextTokens: 100_000 }), 50);
});

test("budget levels: a reported window is used", () => {
  assert.equal(contextPercentOf({ contextTokens: 100_000, contextWindow: 1_000_000 }), 10);
});

test("budget levels: critical is higher than warn", () => {
  assert.equal(isHigherLevel("critical", "warn"), true);
});

test("budget levels: a limit is crossed by the change that reaches it", () => {
  assert.equal(crossedLimit(4.9, 5.1, 5), true);
});

test("budget levels: spending that was already over the limit doesn't cross it again", () => {
  assert.equal(crossedLimit(5.1, 6, 5), false);
});
