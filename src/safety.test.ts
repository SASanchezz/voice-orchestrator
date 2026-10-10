import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DestructiveList, utteranceConfirms } from "./destructive.js";
import { DESTRUCTIVE_PATH, resolveProject, type AppConfig } from "./config.js";
import { PermissionBroker } from "./permissions.js";
import type { PermissionUpdate } from "@anthropic-ai/claude-agent-sdk";
import { Registry } from "./registry.js";

const tmp = mkdtempSync(join(tmpdir(), "vo-"));
const destFile = join(tmp, "destructive.yaml");
copyFileSync(DESTRUCTIVE_PATH, destFile);
const list = new DestructiveList(destFile, false);

test("shipped rules flag dangerous commands and pass safe ones", () => {
  for (const [cmd, verb] of [
    ["git push origin main", "push"],
    ["git commit -m 'x'", "commit"],
    ["git reset --hard HEAD~1", "reset"],
    ["rm -rf dist", "delete"],
    ["git checkout .", "discard"],
    ["psql -c 'DROP TABLE users'", "drop"],
    ["git -C ../repo push", "push"],
    ["git -c user.name=x -c user.email=y commit -m z", "commit"],
    ["git --no-pager -C 'my repo' reset --hard", "reset"],
    ["cd api && git push --force", "push"],
  ])
    assert.equal(list.matchText(cmd)?.verb, verb, cmd);
  for (const cmd of ["git add -A", "git status", "git diff --stat", "npm test", "rm notes.txt", "git checkout -b feature", "git -C repo status", "git log --grep push"])
    assert.equal(list.matchText(cmd), undefined, cmd);
});

test("confirm phrase must contain the exact verb", () => {
  assert.ok(utteranceConfirms("Okay, confirm push.", "push"));
  assert.ok(utteranceConfirms("CONFIRM PUSH please", "push"));
  assert.ok(!utteranceConfirms("yes", "push"));
  assert.ok(!utteranceConfirms("confirm", "push"));
  assert.ok(!utteranceConfirms("confirm pushing", "push"));
  assert.ok(!utteranceConfirms(undefined, "push"));
});

test("rules are editable and persist", () => {
  list.add({ pattern: "\\bhelm\\s+uninstall\\b", verb: "uninstall" });
  assert.equal(new DestructiveList(destFile, false).matchText("helm uninstall api")?.verb, "uninstall");
  assert.ok(list.remove("\\bhelm\\s+uninstall\\b"));
  assert.equal(list.matchText("helm uninstall api"), undefined);
});

test("bad regex in file keeps previous rules", () => {
  const f = join(tmp, "bad.yaml");
  writeFileSync(f, "rules:\n  - { pattern: 'git push', verb: push }\n");
  const l = new DestructiveList(f, false);
  writeFileSync(f, "rules:\n  - { pattern: '([', verb: x }\n");
  l.reload();
  assert.equal(l.matchText("git push")?.verb, "push");
});

const cfg = {
  projects: { webshop: { path: "/x", profile: "personal" }, dbadmin: { path: "/y", profile: "personal" } },
  profiles: { personal: { configDir: "/c" } },
  permissions: { reminderMinutes: 60, alwaysDestination: "localSettings" },
} as unknown as AppConfig;

test("spoken project names resolve loosely", () => {
  assert.equal(resolveProject(cfg, "Web shop."), "webshop");
  assert.equal(resolveProject(cfg, "DB admin"), "dbadmin");
  assert.equal(resolveProject(cfg, "billing"), undefined);
});

test("broker: destructive needs the spoken phrase, never 'always'", async () => {
  const reg = new Registry({ webshop: "personal" });
  const broker = new PermissionBroker(cfg, reg, list);
  const events: unknown[] = [];
  reg.on("event", (e) => events.push(e));

  const ac = new AbortController();
  const p = broker.request(reg.activeSession("webshop").id, "Bash", { command: "git push origin main" }, undefined, ac.signal);
  const id = broker.list()[0].id;
  assert.match(JSON.stringify(events[0]), /"destructiveVerb":"push"/);
  assert.equal(reg.activeSession("webshop").status, "waiting_permission");

  assert.match(broker.answer(id, "once", "yes go ahead"), /Not approved/);
  assert.match(broker.answer(id, "always", "confirm push"), /can't be always-allowed/);
  assert.match(broker.answer(id, "once", "confirm push"), /Allowed once/);
  assert.deepEqual(await p, { behavior: "allow" });
  assert.equal(broker.list().length, 0);
});

test("broker: normal request allows 'always' and persists to local settings", async () => {
  const reg = new Registry({ webshop: "personal" });
  const broker = new PermissionBroker(cfg, reg, list);
  const suggestion = { type: "addRules", rules: [{ toolName: "Bash", ruleContent: "npm test:*" }], behavior: "allow", destination: "session" } as PermissionUpdate;
  const p = broker.request(reg.activeSession("webshop").id, "Bash", { command: "npm test" }, [suggestion], new AbortController().signal);
  broker.answer(broker.list()[0].id, "always", "always");
  const r = await p;
  assert.equal(r.behavior, "allow");
  assert.equal((r as { updatedPermissions: { destination: string }[] }).updatedPermissions[0].destination, "localSettings");
});

test("broker in auto mode allows normal commands without asking", async () => {
  const reg = new Registry({ webshop: "personal" });
  const broker = new PermissionBroker(cfg, reg, list);
  broker.setMode("auto");
  assert.deepEqual(await broker.request(reg.activeSession("webshop").id, "Bash", { command: "npm test" }, undefined, new AbortController().signal), { behavior: "allow" });
});

test("broker in auto mode still asks for destructive commands", () => {
  const reg = new Registry({ webshop: "personal" });
  const broker = new PermissionBroker(cfg, reg, list);
  broker.setMode("auto");
  const ac = new AbortController();
  void broker.request(reg.activeSession("webshop").id, "Bash", { command: "git push origin main" }, undefined, ac.signal);
  assert.equal(broker.list()[0].destructive, 'yes - user must say "confirm push"');
  ac.abort();
});

test("broker: stopping a worker denies its pending request", async () => {
  const reg = new Registry({ webshop: "personal" });
  const broker = new PermissionBroker(cfg, reg, list);
  const ac = new AbortController();
  const p = broker.request(reg.activeSession("webshop").id, "Bash", { command: "npm i" }, undefined, ac.signal);
  ac.abort();
  assert.equal((await p).behavior, "deny");
});

test("default ~/.claude profile runs without CLAUDE_CONFIG_DIR (same Keychain login as plain `claude`)", async () => {
  const { envForProfile, loginCommand } = await import("./config.js");
  const { homedir } = await import("node:os");
  const c = { profiles: { p: { configDir: join(homedir(), ".claude") }, w: { configDir: join(homedir(), ".claude-work") } } } as unknown as AppConfig;
  assert.equal(envForProfile(c, "p").CLAUDE_CONFIG_DIR, undefined);
  assert.equal(envForProfile(c, "w").CLAUDE_CONFIG_DIR, join(homedir(), ".claude-work"));
  assert.equal(loginCommand(join(homedir(), ".claude")), "claude auth login");
});

// ------------------------------------------------------------------ plain-language explanations

/** A broker whose explainer answers as given. Its requests are stopped when the test ends, so their reminders don't keep the run alive. */
function brokerWithExplainer(t: TestContext, explain: (project: string, command: string) => Promise<string>) {
  const reg = new Registry({ webshop: "personal" });
  const broker = new PermissionBroker(cfg, reg, list, explain);
  const stopRequests = new AbortController();
  t.after(() => stopRequests.abort());
  const ask = (command: string) =>
    void broker.request(reg.activeSession("webshop").id, "Bash", { command }, undefined, stopRequests.signal);
  return { broker, ask };
}

const settle = () => new Promise((r) => setImmediate(r));

test("explain: a destructive request shows it is being explained", (t) => {
  const { broker, ask } = brokerWithExplainer(t, () => new Promise(() => {}));
  ask("rm -rf tmp");
  assert.equal(broker.requests()[0].explaining, true);
});

test("explain: the explanation is attached to the waiting request", async (t) => {
  const { broker, ask } = brokerWithExplainer(t, async () => "Deletes the tmp folder. Low risk.");
  ask("rm -rf tmp");
  await settle();
  assert.deepEqual([broker.requests()[0].explanation, broker.requests()[0].explaining], ["Deletes the tmp folder. Low risk.", false]);
});

test("explain: the explainer is given the project and the raw command", async (t) => {
  const asked: string[][] = [];
  const { ask } = brokerWithExplainer(t, async (project, command) => (asked.push([project, command]), "x"));
  ask("rm -rf tmp");
  await settle();
  assert.deepEqual(asked, [["webshop", "rm -rf tmp"]]);
});

test("explain: a non-destructive request is not explained", async (t) => {
  let calls = 0;
  const { broker, ask } = brokerWithExplainer(t, async () => (calls++, "x"));
  broker.setMode("ask");
  ask("npm test");
  await settle();
  assert.deepEqual([calls, broker.requests()[0].explaining], [0, false]);
});

test("explain: a failed explanation leaves the request answerable, without text", async (t) => {
  const { broker, ask } = brokerWithExplainer(t, async () => { throw new Error("offline"); });
  ask("rm -rf tmp");
  await settle();
  assert.deepEqual([broker.requests()[0].explanation, broker.requests()[0].explaining], [undefined, false]);
});

