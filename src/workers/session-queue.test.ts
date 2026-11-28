import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import { SessionQueue } from "./session-queue.js";

/** A queue for a session whose last task succeeded, so the next one can be taken. */
function doneSession() {
  setStateDir(mkdtempSync(join(tmpdir(), "vo-queue-")));
  const { registry, sessions } = openRegistry({ webshop: "personal" }, new AppEvents());
  const { id } = registry.activeSession("webshop");
  sessions.updateSession(id, { status: "done" });
  return { queue: new SessionQueue(sessions), sessions, id };
}

const instructionsIn = (queue: SessionQueue, id: string) => queue.itemsOf(id).map((item) => item.instruction);

test("session queue: each queued task gets its own id", () => {
  const { queue, id } = doneSession();
  queue.add(id, { instruction: "add tests" });
  queue.add(id, { instruction: "add tests" });
  const [first, second] = queue.itemsOf(id);
  assert.notEqual(first?.id, second?.id);
});

test("session queue: a task with its own model is saved with it", () => {
  const { queue, id } = doneSession();
  queue.add(id, { instruction: "add tests", model: "opus" });
  assert.equal(queue.itemsOf(id)[0]?.model, "opus");
});

test("session queue: the next task comes off the front", () => {
  const { queue, id } = doneSession();
  queue.add(id, { instruction: "add tests" });
  queue.add(id, { instruction: "fix the footer" });
  assert.equal(queue.takeNext(id)?.instruction, "add tests");
});

test("session queue: nothing is taken after a task that failed", () => {
  const { queue, sessions, id } = doneSession();
  queue.add(id, { instruction: "add tests" });
  sessions.updateSession(id, { status: "failed" });
  assert.equal(queue.takeNext(id), undefined);
});

test("session queue: nothing is taken while paused, even after a task that succeeded", () => {
  const { queue, id } = doneSession();
  queue.add(id, { instruction: "add tests" });
  queue.pause(id);
  assert.equal(queue.takeNext(id), undefined);
});

test("session queue: the first task can be taken while paused, to resume it", () => {
  const { queue, id } = doneSession();
  queue.add(id, { instruction: "add tests" });
  queue.pause(id);
  assert.equal(queue.takeFirst(id)?.instruction, "add tests");
});

test("session queue: an empty queue is never paused", () => {
  const { queue, id } = doneSession();
  queue.pause(id);
  assert.equal(queue.isPaused(id), false);
});

test("session queue: emptying a paused queue unpauses it", () => {
  const { queue, id } = doneSession();
  queue.add(id, { instruction: "add tests" });
  queue.pause(id);
  queue.clear(id);
  assert.equal(queue.isPaused(id), false);
});

test("session queue: replacing keeps the order it is given", () => {
  const { queue, id } = doneSession();
  queue.add(id, { instruction: "add tests" });
  queue.add(id, { instruction: "fix the footer" });
  queue.replace(id, queue.itemsOf(id).toReversed());
  assert.deepEqual(instructionsIn(queue, id), ["fix the footer", "add tests"]);
});
