import { test } from "node:test";
import assert from "node:assert/strict";
import { macKeycode } from "./hotkey.js";

const RIGHT_OPTION = 61;

test("right alt is the right Option key", () => {
  assert.equal(macKeycode("RIGHT ALT"), RIGHT_OPTION);
});

test("mac key names work as synonyms", () => {
  assert.equal(macKeycode("right option"), RIGHT_OPTION);
});

test("function keys resolve", () => {
  assert.equal(macKeycode("F13"), 105);
});

test("unknown key names are rejected", () => {
  assert.throws(() => macKeycode("hyper"), /Unknown hotkey/);
});
