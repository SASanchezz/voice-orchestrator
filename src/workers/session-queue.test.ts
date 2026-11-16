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

test("session queue: a task without its own model is saved as plain text", () => {
  const { queue, sessions, id } = doneSession();
  queue.add(id, { instruction: "add tests" });
  assert.deepEqual(sessions.session(id).queued, ["add tests"]);
});

test("session queue: a task with its own model is saved with it", () => {
  const { queue, sessions, id } = doneSession();
  queue.add(id, { instruction: "add tests", model: "opus" });
  assert.deepEqual(sessions.session(id).queued, [{ instruction: "add tests", model: "opus" }]);
});

test("session queue: the next task comes back with its own model", () => {
  const { queue, id } = doneSession();
  queue.add(id, { instruction: "add tests", model: "opus" });
  assert.deepEqual(queue.takeNext(id), { instruction: "add tests", model: "opus" });
});

test("session queue: queued tasks are listed by their instructions", () => {
  const { queue, id } = doneSession();
  queue.add(id, { instruction: "add tests", model: "opus" });
  queue.add(id, { instruction: "fix the footer" });
  assert.deepEqual(queue.queuedOf(id), ["add tests", "fix the footer"]);
});

test("session queue: removing a task with its own model returns its instruction", () => {
  const { queue, id } = doneSession();
  queue.add(id, { instruction: "add tests", model: "opus" });
  assert.equal(queue.removeAt(id, 0), "add tests");
});
