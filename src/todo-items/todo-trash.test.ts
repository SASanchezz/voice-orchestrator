import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TodoItemFile } from "./todo-item-file.js";
import { TodoItems } from "./todo-items.js";
import { TodoTrash } from "./todo-trash.js";

const KEPT_DELETED = 20;

function threeItems(): { items: TodoItems; trash: TodoTrash; file: string } {
  const file = join(mkdtempSync(join(tmpdir(), "vo-trash-")), "todo-items.json");
  const store = new TodoItemFile(file);
  const items = new TodoItems(store);
  for (const title of ["one", "two", "three"]) items.add({ title, description: "" });
  return { items, trash: new TodoTrash(store), file };
}

const titles = (items: TodoItems): string[] => items.list().map((item) => item.title);

test("todo trash: a deleted item leaves the list", () => {
  const { items, trash } = threeItems();
  trash.remove(items.find(2));
  assert.deepEqual(titles(items), ["one", "three"]);
});

test("todo trash: a restored item comes back in its place, under its own number", () => {
  const { items, trash } = threeItems();
  trash.remove(items.find(2));
  const [deleted] = trash.deleted();
  assert.ok(deleted);
  trash.restore(deleted);
  assert.deepEqual(titles(items), ["one", "two", "three"]);
});

test("todo trash: a restored item is no longer among the deleted", () => {
  const { items, trash } = threeItems();
  trash.remove(items.find(2));
  const [deleted] = trash.deleted();
  assert.ok(deleted);
  trash.restore(deleted);
  assert.deepEqual(trash.deleted(), []);
});

test("todo trash: deletions can still be undone after a restart", () => {
  const { items, trash, file } = threeItems();
  trash.remove(items.find(1));
  assert.equal(new TodoTrash(new TodoItemFile(file)).deleted()[0]?.title, "one");
});

test("todo trash: only the last deletions are kept", () => {
  const { items, trash } = threeItems();
  for (let n = 0; n <= KEPT_DELETED; n++) trash.remove(items.add({ title: `extra ${n}`, description: "" }));
  assert.equal(trash.deleted().length, KEPT_DELETED);
});
