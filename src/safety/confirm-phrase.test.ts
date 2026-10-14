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

test("a comma between confirm and the verb still confirms", () => {
  assert.ok(utteranceConfirms("Confirm, remove.", "remove"));
});

test("'and' between confirm and the verb still confirms", () => {
  assert.ok(utteranceConfirms("confirm and remove", "remove"));
});

test("another word between confirm and the verb is not the confirm phrase", () => {
  assert.ok(!utteranceConfirms("confirm we never push", "push"));
});

test("a different verb after 'and' is not the confirm phrase", () => {
  assert.ok(!utteranceConfirms("confirm and remove", "push"));
});

test("confirm must be its own word", () => {
  assert.ok(!utteranceConfirms("reconfirm push", "push"));
});

test("don't confirm is a refusal", () => {
  assert.ok(!utteranceConfirms("Don't confirm push yet", "push"));
});

test("do not confirm is a refusal", () => {
  assert.ok(!utteranceConfirms("do not confirm push", "push"));
});

test("no words confirm nothing", () => {
  assert.ok(!utteranceConfirms(undefined, "push"));
});
