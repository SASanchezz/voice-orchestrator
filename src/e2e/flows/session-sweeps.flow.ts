import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import type { SessionState } from "../../registry/registry-schema.js";
import { app } from "../support/harness.js";
import { pause, uiPost, untilIdle } from "../support/helpers.js";

const { core, workers } = app;
const idsOfDbadmin = (): string[] => core.sessions.sessionsOf("dbadmin").map((s) => s.id);

/** Opened by the first test, beside the session dbadmin already has; set here because imports run before any test. */
let kept: SessionState;
let running: SessionState;

/** Right-clicks `kept` while `running` works, beside the idle session dbadmin had. */
async function closeOthersOfKept(): Promise<string> {
  kept = core.registry.createSession("dbadmin");
  running = core.registry.createSession("dbadmin");
  workers.intake.runInSession(running.id, "sleep: 10000");
  while (core.sessions.session(running.id).status !== "running") await pause(10);
  const res = await uiPost(`/api/sessions/${kept.id}/close-others`, {});
  return z.object({ message: z.string() }).parse(await res.json()).message;
}

test("ui: close other sessions closes the idle ones, keeping the clicked and the running session", async () => {
  const report = await closeOthersOfKept();
  assert.match(report, new RegExp(`^Closed dbadmin session \\d+\\. Skipped session ${running.number}: its worker`));
});

test("ui: close other sessions leaves the clicked session and the running one open", () => {
  assert.deepEqual(idsOfDbadmin(), [kept.id, running.id]);
});

test("ui: close other sessions makes the clicked session active", () => {
  assert.equal(core.registry.activeSession("dbadmin").id, kept.id);
});

test("ui: close all skips the running session and keeps it open", async () => {
  assert.equal((await uiPost("/api/projects/dbadmin/sessions/close-all", {})).status, 200);
  assert.deepEqual(idsOfDbadmin(), [running.id]);
});

test("ui: close all with nothing running leaves the project one fresh session", async () => {
  await uiPost(`/api/sessions/${running.id}/stop`, {});
  await untilIdle("dbadmin");
  await uiPost("/api/projects/dbadmin/sessions/close-all", {});
  const remaining = idsOfDbadmin();
  assert.deepEqual([remaining.length, remaining.includes(running.id)], [1, false]);
});
