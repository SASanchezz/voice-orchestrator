import { test } from "node:test";
import assert from "node:assert/strict";
import { newSpendUsd } from "./run-cost.js";

test("run cost: a running total below the last one seen started over, so all of it is new", () => {
  assert.equal(newSpendUsd(0.4, 3), 0.4);
});

test("run cost: only the growth of the running total is new spend", () => {
  assert.equal(newSpendUsd(3.5, 3), 0.5);
});
