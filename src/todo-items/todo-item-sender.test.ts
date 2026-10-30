import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TodoItemFile } from "./todo-item-file.js";
import { TodoItemSender, type TaskSessions, type TaskStarter } from "./todo-item-sender.js";
import { TodoItems } from "./todo-items.js";

/** Remembers the tasks it was given. */
class RecordingStarter implements TaskStarter {
  started: [string, string][] = [];

  runInSession(sessionId: string, instruction: string): string {
    this.started.push([sessionId, instruction]);
    return `Started on ${sessionId}.`;
  }
}

/** Each project starts with session "<project>-1"; a new session takes the next number. */
class NumberedSessions implements TaskSessions {
  private opened = new Map<string, number>();

  activeSessionOf(project: string): string {
    return `${project}-${this.opened.get(project) ?? 1}`;
  }

  openSessionIn(project: string): string {
    this.opened.set(project, (this.opened.get(project) ?? 1) + 1);
    return this.activeSessionOf(project);
  }

  projectOf(sessionId: string): string {
    return sessionId.split("-")[0] ?? "";
  }
}

function senderWith(items: TodoItems): { sender: TodoItemSender; tasks: RecordingStarter } {
  const tasks = new RecordingStarter();
  return { sender: new TodoItemSender(items, tasks, new NumberedSessions()), tasks };
}

function emptyList(): TodoItems {
  return new TodoItems(new TodoItemFile(join(mkdtempSync(join(tmpdir(), "vo-send-")), "todo-items.json")));
}

function listWithFooterItem(): TodoItems {
  const items = emptyList();
  items.add({ title: "Fix the footer", description: "", project: "webshop" });
  return items;
}

function sessionsOfRuns(items: TodoItems): string[] {
  return items.find(1).runs.map((run) => run.sessionId);
}

test("todo send: the item goes to its project's active session as its title, then its description", () => {
  const items = emptyList();
  items.add({ title: "Fix the footer", description: "Links overlap on mobile.", project: "webshop" });
  const { sender, tasks } = senderWith(items);
  sender.send(1);
  assert.deepEqual(tasks.started, [["webshop-1", "Fix the footer\n\nLinks overlap on mobile."]]);
});

test("todo send: an item without a description goes as its title alone", () => {
  const items = emptyList();
  items.add({ title: "Bump the version", description: "", project: "webshop" });
  const { sender, tasks } = senderWith(items);
  sender.send(1);
  assert.deepEqual(tasks.started, [["webshop-1", "Bump the version"]]);
});

test("todo send: the item stays open", () => {
  const items = listWithFooterItem();
  senderWith(items).sender.send(1);
  assert.equal(items.find(1).done, false);
});

test("todo send: an item without a project is refused", () => {
  const items = emptyList();
  items.add({ title: "Call the bank", description: "" });
  assert.throws(() => senderWith(items).sender.send(1), /has no project/);
});

test("todo send: an item without a project can go to a project named for it", () => {
  const items = emptyList();
  items.add({ title: "Call the bank", description: "" });
  senderWith(items).sender.send(1, "admin");
  assert.deepEqual(sessionsOfRuns(items), ["admin-1"]);
});

test("todo send: the same item runs on several projects, each run remembered", () => {
  const items = listWithFooterItem();
  const { sender } = senderWith(items);
  sender.send(1);
  sender.send(1, "blog");
  assert.deepEqual(sessionsOfRuns(items), ["webshop-1", "blog-1"]);
});

test("todo send: a new session runs beside the project's active one", () => {
  const items = listWithFooterItem();
  const { sender } = senderWith(items);
  sender.send(1);
  sender.sendToNewSession(1);
  assert.deepEqual(sessionsOfRuns(items), ["webshop-1", "webshop-2"]);
});

test("todo send: a run names the project of the session it went to", () => {
  const items = listWithFooterItem();
  senderWith(items).sender.sendToSession(1, "blog-3");
  assert.equal(items.find(1).runs[0]?.project, "blog");
});

test("todo send: a run keeps the instruction as it was sent", () => {
  const items = listWithFooterItem();
  senderWith(items).sender.send(1);
  items.edit(1, { title: "Fix the header" });
  assert.equal(items.find(1).runs[0]?.instruction, "Fix the footer");
});
