import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import { testConfig } from "../testing/test-config.js";
import { QueueControl } from "./queue-control.js";
import { QueuedTasks } from "./queued-tasks.js";
import { SessionQueue } from "./session-queue.js";
import { WorkerDirectory } from "./worker-directory.js";

/** webshop's only session, with "add tests" and "fix the footer" queued. */
function webshopQueue() {
  setStateDir(mkdtempSync(join(tmpdir(), "vo-queued-tasks-")));
  const cfg = testConfig({ projects: { webshop: { path: "/code/webshop", profile: "personal" } } });
  const { registry, projects, sessions } = openRegistry({ webshop: "personal" }, new AppEvents());
  const id = registry.activeSession("webshop").id;
  const queue = new SessionQueue(sessions);
  queue.add(id, { instruction: "add tests" });
  queue.add(id, { instruction: "fix the footer" });
  return { id, queue, directory: new WorkerDirectory(cfg, projects, sessions) };
}

/** `resumed` records the sessions whose runs were told to resume. */
function queuedSession() {
  const { id, queue, directory } = webshopQueue();
  const resumed: string[] = [];
  const runs = { resume: (sessionId: string) => Promise.resolve(void resumed.push(sessionId)) };
  const control = new QueueControl(queue, runs, directory);
  return { id, queue, tasks: new QueuedTasks(queue, directory), control, resumed };
}

const idAt = (queue: SessionQueue, id: string, index: number) => queue.itemsOf(id)[index]?.id ?? "";
const instructionsIn = (queue: SessionQueue, id: string) => queue.itemsOf(id).map((item) => item.instruction);

test("queued tasks: a spoken place finds that task's id", () => {
  const { id, queue, tasks } = queuedSession();
  assert.equal(tasks.idOf(id, { place: 2 }), idAt(queue, id, 1));
});

test("queued tasks: removing one says what was removed and what is left", () => {
  const { id, queue, tasks } = queuedSession();
  assert.equal(tasks.remove(id, idAt(queue, id, 0)), "Removed #1 add tests from webshop's queue; 1 still queued.");
});

test("queued tasks: a task that already left the queue is an error", () => {
  const { id, tasks } = queuedSession();
  assert.throws(() => tasks.remove(id, "gone"), /no longer queued/);
});

test("queued tasks: editing keeps the task's place", () => {
  const { id, queue, tasks } = queuedSession();
  tasks.edit(id, idAt(queue, id, 0), "add tests for login");
  assert.deepEqual(instructionsIn(queue, id), ["add tests for login", "fix the footer"]);
});

test("queued tasks: moving one to the front makes it run next", () => {
  const { id, queue, tasks } = queuedSession();
  tasks.moveToFront(id, idAt(queue, id, 1));
  assert.deepEqual(instructionsIn(queue, id), ["fix the footer", "add tests"]);
});

test("queued tasks: a paused queue is listed as paused", () => {
  const { id, queue, tasks } = queuedSession();
  queue.pause(id);
  assert.match(tasks.list(id), /has 2 queued \(paused\)/);
});

test("queue control: resuming hands the session's queue back to its runs", () => {
  const { id, control, resumed } = queuedSession();
  control.resume(id);
  assert.deepEqual(resumed, [id]);
});

test("queue control: resuming says how many tasks go on", () => {
  const { id, control } = queuedSession();
  assert.equal(control.resume(id), "Resumed webshop's queue; 2 to go.");
});

test("queue control: clearing says how many were removed", () => {
  const { id, control } = queuedSession();
  assert.equal(control.clear(id), "Cleared webshop's queue; 2 removed.");
});
