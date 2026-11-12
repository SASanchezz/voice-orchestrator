import { test } from "node:test";
import assert from "node:assert/strict";
import { symbolRole } from "./symbol-roles.js";

test("symbol roles: a capitalised name is a class", () => {
  assert.equal(symbolRole("ChangeView", " {"), "class");
});

test("symbol roles: a constructor call is still a class", () => {
  assert.equal(symbolRole("Thing", "();"), "class");
});

test("symbol roles: a name before a bracket is a method", () => {
  assert.equal(symbolRole("toView", " (item)"), "method");
});

test("symbol roles: any other name is a variable", () => {
  assert.equal(symbolRole("user", "."), "variable");
});

test("symbol roles: an ALL_CAPS constant is a variable", () => {
  assert.equal(symbolRole("MAX_SIZE", ";"), "variable");
});
