import { test } from "node:test";
import assert from "node:assert/strict";
import type { TodoItemView } from "./protocol.js";
import { groupByProject, NO_PROJECT } from "./todo-groups.js";

function item(id: number, project?: string): TodoItemView {
  return { id, title: `#${id}`, description: "", ...(project && { project }), done: false, createdAt: "", runs: [] };
}

function groupNames(items: TodoItemView[], listed: string[]): string[] {
  return groupByProject(items, listed).map((group) => group.project);
}

test("todo groups: projects come in the order they are listed", () => {
  assert.deepEqual(groupNames([item(1, "blog"), item(2, "webshop")], ["webshop", "blog"]), ["webshop", "blog"]);
});

test("todo groups: items without a project come last", () => {
  assert.deepEqual(groupNames([item(1), item(2, "blog")], ["blog"]), ["blog", NO_PROJECT]);
});

test("todo groups: a project no longer listed still shows its items, after the listed ones", () => {
  assert.deepEqual(groupNames([item(1, "gone"), item(2, "blog")], ["blog"]), ["blog", "gone"]);
});

test("todo groups: a project without items is left out", () => {
  assert.deepEqual(groupNames([item(1, "blog")], ["webshop", "blog"]), ["blog"]);
});

test("todo groups: a project's items keep their order", () => {
  const [group] = groupByProject([item(3, "blog"), item(1, "webshop"), item(5, "blog")], ["blog"]);
  assert.deepEqual(
    group?.items.map((shown) => shown.id),
    [3, 5],
  );
});
