import { test } from "node:test";
import assert from "node:assert/strict";
import { workerCalls } from "../support/fake-worker.js";
import { app, voice } from "../support/harness.js";
import { mark, uiPost } from "../support/helpers.js";
import { dbadmin } from "../support/sandbox.js";

const { core, permissions, workers } = app;

test("sessions: a new session is active and starts its own worker conversation", async () => {
  const i = mark();
  voice.say("new session dbadmin");
  await voice.heard(/Opened dbadmin session 2; it is now active/, i);
  voice.say("in dbadmin do:\nrun: mkdir -p tmp/second");
  await voice.heard(/dbadmin session 2 wants approval for Bash: mkdir -p tmp\/second/, i);
  assert.equal(workerCalls.filter((c) => c.cwd === dbadmin && !c.summary).at(-1)!.resume, undefined);
});

test("sessions: listed with the active one marked", async () => {
  const i = mark();
  voice.say("sessions dbadmin");
  assert.match(await voice.heard(/session 1:/, i), /session 2 \(active\): waiting_permission/);
});

test("sessions: switching back routes tasks to the first session", async () => {
  const i = mark();
  voice.say("switch dbadmin to 1");
  await voice.heard(/dbadmin session 1 is now active/, i);
  assert.equal(core.registry.activeSession("dbadmin").number, 1);
});

test("sessions: closing a busy session stops its worker and forgets it", async () => {
  const i = mark();
  voice.say("close dbadmin session 2");
  await voice.heard(/Closed dbadmin session 2/, i);
  assert.deepEqual(
    {
      sessions: core.sessions.sessionsOf("dbadmin").length,
      busy: workers.control.isBusy("dbadmin"),
      pending: permissions.views.list().length,
    },
    { sessions: 1, busy: false, pending: 0 },
  );
});

test("ui: sessions can be opened, switched and closed by click", async () => {
  assert.equal((await uiPost("/api/projects/dbadmin/sessions", {})).status, 200);
  const second = core.registry.activeSession("dbadmin");
  const first = core.registry.sessionByNumber("dbadmin", 1);
  assert.equal((await uiPost(`/api/sessions/${first.id}/activate`, {})).status, 200);
  assert.equal((await uiPost(`/api/sessions/${second.id}/close`, {})).status, 200);
  assert.deepEqual(
    core.sessions.sessionsOf("dbadmin").map((s) => s.id),
    [first.id],
  );
});
