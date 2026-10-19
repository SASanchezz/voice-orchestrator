import { test } from "node:test";
import assert from "node:assert/strict";
import { pickTodoItem, todoItemLabel } from "./todo-item-pick.js";
import type { TodoItem } from "./todo-item-schema.js";

const CREATED = "2026-10-16T09:00:00.000Z";
const item = (id: number, title: string, done = false): TodoItem => ({
  id,
  title,
  description: id === 2 ? "Overlapping links on mobile" : "",
  done,
  createdAt: CREATED,
});
const ITEMS = [item(1, "Fix the header"), item(2, "Fix the footer"), item(3, "Fix the header again", true)];

test("todo pick: by its number", () => {
  assert.equal(pickTodoItem(ITEMS, "2").title, "Fix the footer");
});

test("todo pick: by its number written with #", () => {
  assert.equal(pickTodoItem(ITEMS, "#1").title, "Fix the header");
});

test("todo pick: by words from its description", () => {
  assert.equal(pickTodoItem(ITEMS, "links on MOBILE").id, 2);
});

test("todo pick: of an open and a done item matching, the open one is meant", () => {
  assert.equal(pickTodoItem(ITEMS, "header").id, 1);
});

test("todo pick: several open matches ask which one", () => {
  assert.throws(() => pickTodoItem(ITEMS, "fix the"), /Several to-do items mention "fix the": #1 .*#2 /);
});

test("todo pick: words matching nothing are refused", () => {
  assert.throws(() => pickTodoItem(ITEMS, "groceries"), /No to-do item mentions "groceries"/);
});

test("todo pick: an unknown number is refused", () => {
  assert.throws(() => pickTodoItem(ITEMS, "9"), /no to-do item #9/);
});

test("todo pick: an item's label names its project", () => {
  assert.equal(todoItemLabel({ ...item(4, "Ship it"), project: "webshop" }), "#4 Ship it (webshop)");
});
