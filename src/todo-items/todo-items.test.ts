import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TodoItemFile } from "./todo-item-file.js";
import { NO_PROJECT } from "./todo-item-schema.js";
import { TodoItems } from "./todo-items.js";

const FOOTER = { title: "Fix the footer", description: "The links overlap on mobile.", project: "webshop" };
const CALL = { title: "Call the bank", description: "" };

function freshFile(): string {
  return join(mkdtempSync(join(tmpdir(), "vo-todo-")), "todo-items.json");
}

function listIn(file = freshFile()): TodoItems {
  return new TodoItems(new TodoItemFile(file));
}

test("todo items: a new item is open, numbered from 1, with its creation time", () => {
  const item = listIn().add(FOOTER);
  assert.deepEqual([item.id, item.done, Number.isNaN(Date.parse(item.createdAt))], [1, false, false]);
});

test("todo items: each new item gets the next number", () => {
  const items = listIn();
  items.add(FOOTER);
  assert.equal(items.add(CALL).id, 2);
});

test("todo items: an edit changes only the fields given", () => {
  const items = listIn();
  items.add(FOOTER);
  const edited = items.edit(1, { title: "Fix the footer links" });
  assert.deepEqual(edited, { ...items.find(1), ...FOOTER, title: "Fix the footer links" });
});

test("todo items: an edit can move an item to another project", () => {
  const items = listIn();
  items.add(FOOTER);
  assert.equal(items.edit(1, { project: "billing" }).project, "billing");
});

test("todo items: an edit can take an item off its project", () => {
  const items = listIn();
  items.add(FOOTER);
  assert.equal(items.edit(1, { project: NO_PROJECT }).project, undefined);
});

test("todo items: an item can be ticked off and reopened", () => {
  const items = listIn();
  items.add(CALL);
  items.setDone(1, true);
  assert.equal(items.setDone(1, false).done, false);
});

test("todo items: an unknown number is refused", () => {
  assert.throws(() => listIn().setDone(7, true), /no to-do item #7/);
});

test("todo items: the list survives a restart", () => {
  const file = freshFile();
  listIn(file).add(FOOTER);
  listIn(file).setDone(1, true);
  assert.deepEqual(
    listIn(file)
      .list()
      .map(({ title, done }) => ({ title, done })),
    [{ title: FOOTER.title, done: true }],
  );
});

test("todo items: numbers keep counting after a restart", () => {
  const file = freshFile();
  listIn(file).add(FOOTER);
  assert.equal(listIn(file).add(CALL).id, 2);
});

test("todo items: a damaged file stops the app instead of being overwritten", () => {
  const file = freshFile();
  writeFileSync(file, "{not json");
  assert.throws(() => listIn(file), /todo-items\.json can't be read/);
});

test("todo items: a list saved before runs were kept still loads, with no runs", () => {
  const file = freshFile();
  const item = { id: 1, ...CALL, done: false, createdAt: "2026-10-16T09:00:00.000Z" };
  writeFileSync(file, JSON.stringify({ nextId: 2, items: [item], deleted: [] }));
  assert.deepEqual(listIn(file).find(1).runs, []);
});

function runIn(sessionId: string) {
  return { project: "webshop", sessionId, instruction: FOOTER.title, sentAt: "" };
}

test("todo items: only the last few runs of an item are kept", () => {
  const items = listIn();
  items.add(FOOTER);
  for (let at = 1; at <= 12; at++) items.addRun(1, runIn(`s${at}`));
  assert.equal(items.find(1).runs[0]?.sessionId, "s3");
});
