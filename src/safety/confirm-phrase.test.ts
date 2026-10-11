import { test } from "node:test";
import assert from "node:assert/strict";
import { utteranceConfirms } from "./confirm-phrase.js";

test("the confirm phrase may sit inside a longer sentence", () => {
  assert.ok(utteranceConfirms("Okay, confirm push.", "push"));
});

test("the confirm phrase ignores case", () => {
  assert.ok(utteranceConfirms("CONFIRM PUSH please", "push"));
});

test("a plain yes is not the confirm phrase", () => {
  assert.ok(!utteranceConfirms("yes", "push"));
});

test("confirm without the verb is not enough", () => {
  assert.ok(!utteranceConfirms("confirm", "push"));
});

test("the verb must be said exactly", () => {
  assert.ok(!utteranceConfirms("confirm pushing", "push"));
});

test("no words confirm nothing", () => {
  assert.ok(!utteranceConfirms(undefined, "push"));
});
