import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { brain } from "../support/fake-operator.js";
import { sessionsByCwd, workerCalls } from "../support/fake-worker.js";
import { app, voice } from "../support/harness.js";
import { mark } from "../support/helpers.js";
import { acmeWeb, cfg, commitCount, dbadmin, root, staged } from "../support/sandbox.js";

const { core, permissions } = app;

test("open two projects by spoken name on different accounts", async () => {
  let i = mark();
  voice.say("open database admin on personal");
  assert.match(await voice.heard(/Opened dbadmin/, i), /personal account/);
  i = mark();
  voice.say("open acme-web on work");
  assert.match(await voice.heard(/Opened acme-web/, i), /work account/);
  assert.equal(cfg.projects.dbadmin.path, dbadmin);
  assert.equal(cfg.projects["acme-web"].path, acmeWeb);
  // remembered for next start
  assert.ok(readFileSync(join(root, "state", "projects.json"), "utf8").includes("acme-web"));
});

/** dbadmin's script asks for each step; the harmless ones are allowed, the commit waits for its confirm phrase. */
async function runDbadminUpToItsCommit(): Promise<void> {
  let i = mark();
  voice.say(
    "in dbadmin do:\nrun: echo hello > dummy.txt\nrun: git add dummy.txt\nrun: git -c user.email=t@t -c user.name=t commit -qm dummy",
  );
  await voice.heard(/Started on dbadmin \(personal account\)/, i);
  await voice.heard(/dbadmin wants approval for Bash: echo hello > dummy.txt/, i);
  // answer once, then the next harmless step
  i = mark();
  voice.say("once");
  await voice.heard(/Allowed once: dbadmin/, i);
  await voice.heard(/dbadmin wants approval for Bash: git add dummy.txt/, i);
  i = mark();
  voice.say("yes");
  await voice.heard(/Allowed once/, i);
  // the commit is destructive: plain "yes" must NOT pass
  assert.match(await voice.heard(/DESTRUCTIVE: user must say "confirm commit"/, i), /dbadmin/);
  i = mark();
  voice.say("yes");
  await voice.heard(/Not approved: destructive/, i);
}

/** Started while dbadmin still waits for its commit. */
async function startAcmeWebWhileDbadminWaits(): Promise<void> {
  const i = mark();
  voice.say("in acme-web do:\nrun: mkdir -p tmp && echo fe > tmp/dummy-fe.txt\nsleep: 300\nrun: rm -rf tmp");
  await voice.heard(/Started on acme-web \(work account\)/, i);
  await voice.heard(/acme-web wants approval for Bash: mkdir/, i);
}

function assertEachWorkerOnItsAccount(): void {
  const calls = Object.fromEntries(workerCalls.filter((c) => !c.summary).map((c) => [basename(c.cwd), c] as const));
  assert.equal(calls.dbadmin.account, "personal");
  assert.equal(calls["acme-web"].account, "work");
  assert.equal(calls["acme-web"].cwd, acmeWeb);
  assert.equal(calls.dbadmin.bin, "/fake/claude");
}

test("both workers run in parallel, each on its own account, and ask permission by voice", async () => {
  await runDbadminUpToItsCommit();
  assert.equal(commitCount(dbadmin), 1, "nothing committed after a plain yes");
  await startAcmeWebWhileDbadminWaits();
  // two permission requests are now pending
  assert.equal(permissions.views.list().length, 2);
  assert.equal(core.registry.activeSession("dbadmin").status, "waiting_permission");
  assert.equal(core.registry.activeSession("acme-web").status, "waiting_permission");
  assertEachWorkerOnItsAccount();
});

test("confirm phrase approves the commit; finished task is announced", async () => {
  // the last announced request is acme-web's mkdir; answer it "always"
  let i = mark();
  voice.say("always");
  await voice.heard(/Allowed permanently: acme-web/, i);

  // now handle dbadmin's commit: the brain tracks the latest permission id, so point it back
  brain.lastPermission = permissions.views.list().find((p) => p.project === "dbadmin")!.id;
  i = mark();
  voice.say("confirm commit");
  await voice.heard(/Allowed once: dbadmin: Bash: git .*commit/, i);
  await voice.heard(/^dbadmin session \d+ done: /, i);
  assert.equal(commitCount(dbadmin), 2, "commit happened");
  assert.equal(core.registry.activeSession("dbadmin").status, "done");
});

test("cleanup step (rm -rf) is destructive too and can be denied; worker still finishes", async () => {
  const i = mark();
  await voice.heard(/acme-web wants approval for Bash: rm -rf tmp -- DESTRUCTIVE: user must say "confirm delete"/, 0);
  voice.say("deny");
  await voice.heard(/Denied acme-web/, i);
  await voice.heard(/^acme-web session \d+ done: /, i);
  assert.ok(existsSync(join(acmeWeb, "tmp/dummy-fe.txt")), "denied delete did not run");
  assert.match(core.registry.activeSession("acme-web").lastResult!, /denied: rm -rf tmp/);
});

test("'always' is remembered per account: same command on work runs without asking, on personal it asks", async () => {
  let i = mark();
  voice.say("in acme-web do:\nrun: mkdir -p tmp && echo fe > tmp/dummy-fe.txt");
  await voice.heard(/^acme-web session \d+ done: /, i);
  assert.ok(!voice.spoken.slice(i).some((s) => /acme-web wants approval/.test(s)), "no prompt on the work account");
  // the worker resumed the same session
  const feCalls = workerCalls.filter((c) => c.cwd === acmeWeb && !c.summary);
  assert.equal(feCalls.at(-1)!.resume, feCalls[0].resume ?? sessionsByCwd.get(acmeWeb));
  assert.ok(feCalls.at(-1)!.resume, "second task resumed the first session");

  i = mark();
  voice.say("in dbadmin do:\nrun: mkdir -p tmp && echo fe > tmp/dummy-fe.txt");
  await voice.heard(/dbadmin wants approval/, i);
  voice.say("deny");
  await voice.heard(/^dbadmin session \d+ done: /, i);
});

test("details: summary is generated on the project's own account (work stays on work)", async () => {
  const i = mark();
  voice.say("details acme-web");
  const s = await voice.heard(/Summary for acme-web/, i);
  assert.match(s, /\(work\)/);
  assert.equal(workerCalls.filter((c) => c.summary).at(-1)!.account, "work");
});

test("'stage and leave as is' stages without committing; push without confirm is refused", async () => {
  let i = mark();
  voice.say("stage acme-web");
  await voice.heard(/Done, no output|tmp/, i);
  assert.equal(staged(acmeWeb), "tmp/dummy-fe.txt");
  assert.equal(commitCount(acmeWeb), 1, "nothing committed");

  i = mark();
  voice.say("push dbadmin");
  await voice.heard(/Destructive \(push\)\. Not run/, i);
});
