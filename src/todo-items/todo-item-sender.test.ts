import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TodoItemFile } from "./todo-item-file.js";
import { TodoItemSender, type TaskStarter } from "./todo-item-sender.js";
import { TodoItems } from "./todo-items.js";

/** Remembers the tasks it was given. */
class RecordingStarter implements TaskStarter {
  started: [string, string][] = [];

  run(project: string, instruction: string): string {
    this.started.push([project, instruction]);
    return `Started on ${project}.`;
  }
}

function senderWith(items: TodoItems): { sender: TodoItemSender; tasks: RecordingStarter } {
  const tasks = new RecordingStarter();
  return { sender: new TodoItemSender(items, tasks), tasks };
}

function emptyList(): TodoItems {
  return new TodoItems(new TodoItemFile(join(mkdtempSync(join(tmpdir(), "vo-send-")), "todo-items.json")));
}

test("todo send: the item goes to its project as its title, then its description", () => {
  const items = emptyList();
  items.add({ title: "Fix the footer", description: "Links overlap on mobile.", project: "webshop" });
  const { sender, tasks } = senderWith(items);
  sender.send(1);
  assert.deepEqual(tasks.started, [["webshop", "Fix the footer\n\nLinks overlap on mobile."]]);
});

test("todo send: an item without a description goes as its title alone", () => {
  const items = emptyList();
  items.add({ title: "Bump the version", description: "", project: "webshop" });
  assert.equal(senderWith(items).sender.instructionFor(1), "Bump the version");
});

test("todo send: the item stays open", () => {
  const items = emptyList();
  items.add({ title: "Fix the footer", description: "", project: "webshop" });
  senderWith(items).sender.send(1);
  assert.equal(items.find(1).done, false);
});

test("todo send: an item without a project is refused", () => {
  const items = emptyList();
  items.add({ title: "Call the bank", description: "" });
  assert.throws(() => senderWith(items).sender.send(1), /has no project/);
});
