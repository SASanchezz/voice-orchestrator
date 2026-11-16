import { test } from "node:test";
import assert from "node:assert/strict";
import { modelLabel } from "./worker-models.js";

test("worker models: a listed model shows by its name", () => {
  assert.equal(modelLabel("opus"), "Opus");
});

test("worker models: a listed model's 1M-context alias shows by the model's name", () => {
  assert.equal(modelLabel("opus[1m]"), "Opus");
});

test("worker models: a model from config that isn't listed shows as its id", () => {
  assert.equal(modelLabel("claude-opus-4-1"), "claude-opus-4-1");
});

test("worker models: no model shows as Claude Code's default", () => {
  assert.equal(modelLabel(undefined), "Default");
});
