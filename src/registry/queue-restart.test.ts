import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "./open-registry.js";
import { emptySession } from "./session-records.js";

/** A webshop session saved with `queued` as state/registry.json held it, opened again after a restart. */
function reopenedWith(queued: unknown[]) {
  const dir = mkdtempSync(join(tmpdir(), "vo-queue-restart-"));
  setStateDir(dir);
  const session = { ...emptySession("s1", "webshop", 1), status: "running", queued };
  const saved = {
    version: 2,
    projects: { webshop: { name: "webshop", profile: "personal", activeSession: "s1" } },
    sessions: { s1: session },
  };
  writeFileSync(join(dir, "registry.json"), JSON.stringify(saved));
  return openRegistry({ webshop: "personal" }, new AppEvents()).sessions.session("s1");
}

test("queue restart: tasks queued before a restart are still queued", () => {
  const { queued } = reopenedWith([{ id: "q1", instruction: "add tests" }]);
  assert.deepEqual(queued, [{ id: "q1", instruction: "add tests" }]);
});

test("queue restart: tasks queued before a restart wait, paused", () => {
  assert.equal(reopenedWith([{ id: "q1", instruction: "add tests" }]).queuePaused, true);
});

test("queue restart: an empty queue is not paused", () => {
  assert.equal(reopenedWith([]).queuePaused, undefined);
});

test("queue restart: tasks saved before they had ids get one, keeping their model", () => {
  const [plain, withModel] = reopenedWith(["add tests", { instruction: "fix it", model: "opus" }]).queued;
  assert.deepEqual([typeof plain?.id, withModel?.instruction, withModel?.model], ["string", "fix it", "opus"]);
});
