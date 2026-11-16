import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { DEFAULT_PROTECTED_BRANCHES } from "../config/app-config.js";
import { DESTRUCTIVE_PATH, setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import { DestructiveList } from "../safety/destructive-list.js";
import { workerRules } from "../testing/test-worker-rules.js";
import { EditScope } from "./edit-scope.js";
import { PermissionAnnouncer } from "./permission-announcer.js";
import { PermissionAnswers } from "./permission-answers.js";
import { PermissionBroker } from "./permission-broker.js";
import { PermissionPolicy } from "./permission-policy.js";
import { SpokenApprovals } from "./spoken-approvals.js";
import { WaitingRequests } from "./waiting-requests.js";

const tmp = mkdtempSync(join(tmpdir(), "vo-spoken-approvals-"));
setStateDir(tmp);
const rulesFile = join(tmp, "destructive.yaml");
copyFileSync(DESTRUCTIVE_PATH, rulesFile);
const rules = new DestructiveList(rulesFile);
const settings = {
  mode: "ask",
  reminderMinutes: 60,
  alwaysDestination: "localSettings",
  protectedBranches: DEFAULT_PROTECTED_BRANCHES,
} as const;
const NO_SESSION_IN_FRONT = undefined;

/** One project's permissions, wired as in the app, with requests asked from its first or a second session. */
function approvals(t: TestContext) {
  const events = new AppEvents();
  const { sessions, registry } = openRegistry({ webshop: "personal" }, events);
  const policy = new PermissionPolicy("ask", workerRules(rules), new EditScope(() => tmp));
  const waiting = new WaitingRequests(sessions, new PermissionAnnouncer(sessions, events, settings));
  const broker = new PermissionBroker(policy, waiting);
  const first = registry.activeSession("webshop").id;
  const stop = new AbortController();
  t.after(() => stop.abort());
  const ask = (command: string, session = first): Promise<PermissionResult> =>
    broker.request(session, { toolName: "Bash", input: { command } }, { signal: stop.signal });
  const spoken = new SpokenApprovals(waiting, new PermissionAnswers(waiting, sessions, settings), sessions);
  return { ask, spoken, waiting, first, newSession: () => registry.createSession("webshop").id };
}

test("spoken approvals: nothing waiting, an approval is not answered here", (t) => {
  assert.equal(approvals(t).spoken.canAnswer("allow"), false);
});

test("spoken approvals: a verb that names no waiting request is not answered here", (t) => {
  const { ask, spoken } = approvals(t);
  void ask("npm install");
  assert.equal(spoken.canAnswer("allow push"), false);
});

test("spoken approvals: a plain allow lets the only waiting request go ahead", async (t) => {
  const { ask, spoken } = approvals(t);
  const result = ask("npm install");
  spoken.answer("Allow.", NO_SESSION_IN_FRONT);
  assert.deepEqual(await result, { behavior: "allow" });
});

test("spoken approvals: no denies the waiting request", async (t) => {
  const { ask, spoken } = approvals(t);
  const result = ask("npm install");
  spoken.answer("No.", NO_SESSION_IN_FRONT);
  assert.equal((await result).behavior, "deny");
});

test("spoken approvals: allow with the verb lets a destructive request go ahead", async (t) => {
  const { ask, spoken } = approvals(t);
  const result = ask("git push origin main");
  spoken.answer("Allow push.", NO_SESSION_IN_FRONT);
  assert.deepEqual(await result, { behavior: "allow" });
});

test("spoken approvals: a plain allow lets a destructive request go ahead", async (t) => {
  const { ask, spoken } = approvals(t);
  const result = ask("git push origin main");
  spoken.answer("allow", NO_SESSION_IN_FRONT);
  assert.deepEqual(await result, { behavior: "allow" });
});

test("spoken approvals: a destructive request can't be allowed always", (t) => {
  const { ask, spoken } = approvals(t);
  void ask("git push origin main");
  assert.match(spoken.answer("allow always", NO_SESSION_IN_FRONT), /can't be always allowed/);
});

test("spoken approvals: the verb picks its request among several", (t) => {
  const { ask, spoken, waiting } = approvals(t);
  void ask("npm install");
  void ask("git push origin main");
  spoken.answer("allow npm", NO_SESSION_IN_FRONT);
  assert.deepEqual(
    waiting.all().map((pending) => pending.destructive?.verb),
    ["push"],
  );
});

test("spoken approvals: a plain allow with several waiting answers the one asked first", async (t) => {
  const { ask, spoken } = approvals(t);
  const askedFirst = ask("npm install");
  void ask("npm run build");
  spoken.answer("allow", NO_SESSION_IN_FRONT);
  assert.deepEqual(await askedFirst, { behavior: "allow" });
});

test("spoken approvals: the session in front is answered before others", async (t) => {
  const { ask, spoken, first, newSession } = approvals(t);
  void ask("npm install", first);
  const second = newSession();
  const result = ask("npm run build", second);
  spoken.answer("allow", second);
  assert.deepEqual(await result, { behavior: "allow" });
});
