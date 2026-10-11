import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TodoTask } from "./todo-file.js";
import { TodoList } from "./todo-list.js";

const freshList = () => {
  const dir = mkdtempSync(join(tmpdir(), "vo-todo-"));
  return { dir, todo: new TodoList(dir) };
};

const TASK: TodoTask = {
  project: "web shop",
  sessionNumber: 3,
  account: "work",
  savedAt: "2026-10-10T18:04:31.624Z",
  resetsAt: "9pm (Europe/Warsaw)",
  task: "Add sorting to the users list.\n\n---\nKeep the old filters.",
};

test("todo: a saved task reads back whole", () => {
  const { todo } = freshList();
  const { id } = todo.save(TASK);
  assert.deepEqual(todo.find(id), { id, ...TASK });
});

test("todo: each task is its own readable Markdown file", () => {
  const { dir, todo } = freshList();
  const { id } = todo.save(TASK);
  assert.match(
    readFileSync(join(dir, `${id}.md`), "utf8"),
    /^---\nproject: web shop\n[\s\S]*---\nAdd sorting to the users list\./,
  );
});

test("todo: the file name says when and where it was saved", () => {
  const { todo } = freshList();
  assert.equal(todo.save(TASK).id, "20261010-180431-web-shop-s3");
});

test("todo: two tasks saved at the same moment get their own files", () => {
  const { dir, todo } = freshList();
  todo.save(TASK);
  todo.save({ ...TASK, task: "second" });
  assert.equal(readdirSync(dir).length, 2);
});

test("todo: the list is oldest first", () => {
  const { todo } = freshList();
  todo.save({ ...TASK, savedAt: "2026-10-10T19:00:00.000Z", task: "later" });
  todo.save(TASK);
  assert.deepEqual(
    todo.list().map((t) => t.savedAt),
    [TASK.savedAt, "2026-10-10T19:00:00.000Z"],
  );
});

test("todo: tasks are counted per account", () => {
  const { todo } = freshList();
  todo.save(TASK);
  todo.save({ ...TASK, account: "personal" });
  assert.equal(todo.countFor("work"), 1);
});

test("todo: a removed task is gone", () => {
  const { todo } = freshList();
  todo.remove(todo.save(TASK).id);
  assert.deepEqual(todo.list(), []);
});

test("todo: an unknown id is an error", () => {
  const { todo } = freshList();
  assert.throws(() => todo.find("nope"), /No todo task "nope"/);
});

test("todo: a missing folder is an empty list", () => {
  assert.deepEqual(new TodoList(join(tmpdir(), "vo-todo-missing", String(Date.now()))).list(), []);
});
