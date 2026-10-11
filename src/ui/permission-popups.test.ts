import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { DESTRUCTIVE_PATH, setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { PermissionAnnouncer } from "../permissions/permission-announcer.js";
import { PermissionAnswers } from "../permissions/permission-answers.js";
import { PermissionBroker } from "../permissions/permission-broker.js";
import { PermissionExplanations } from "../permissions/permission-explanations.js";
import { PermissionPolicy } from "../permissions/permission-policy.js";
import { WaitingRequests } from "../permissions/waiting-requests.js";
import { openRegistry } from "../registry/open-registry.js";
import { DestructiveList } from "../safety/destructive-list.js";
import { TestPopups } from "../testing/test-popups.js";
import { PermissionPopups } from "./permission-popups.js";

const tmp = mkdtempSync(join(tmpdir(), "vo-popups-"));
setStateDir(tmp);
const rulesFile = join(tmp, "destructive.yaml");
copyFileSync(DESTRUCTIVE_PATH, rulesFile);
const rules = new DestructiveList(rulesFile);
const settings = { mode: "ask", reminderMinutes: 60, alwaysDestination: "localSettings" } as const;
const EXPLANATION = "Pushes your commits to GitHub. Risk: medium.";

/** One project's permissions with pop-ups, wired as in the app. Requests still waiting when the test ends are stopped. */
function permissionsWithPopups(t: TestContext) {
  const events = new AppEvents();
  const { sessions, registry } = openRegistry({ webshop: "personal" }, events);
  const announcer = new PermissionAnnouncer(sessions, events, settings);
  const waiting = new WaitingRequests(sessions, announcer);
  const explanations = new PermissionExplanations(waiting, async () => EXPLANATION, announcer);
  const broker = new PermissionBroker(new PermissionPolicy("ask", rules), waiting, explanations);
  const answers = new PermissionAnswers(waiting, sessions, settings);
  const popups = new TestPopups();
  new PermissionPopups(popups, answers).follow(events);
  const stop = new AbortController();
  t.after(() => stop.abort());
  const { id: session } = registry.activeSession("webshop");
  const ask = (command: string): Promise<PermissionResult> =>
    broker.request(session, { toolName: "Bash", input: { command } }, { signal: stop.signal });
  return { ask, answers, popups, waiting, events };
}

const settle = () => new Promise((r) => setImmediate(r));

test("popups: a waiting request opens a pop-up naming the asker and the command", (t) => {
  const { ask, popups } = permissionsWithPopups(t);
  void ask("npm test");
  assert.deepEqual(popups.latest().content, {
    title: "webshop asks permission",
    warning: "",
    command: "Bash: npm test",
    allowLabel: "Allow once",
  });
});

test("popups: a destructive request's pop-up says Allow is the confirmation", (t) => {
  const { ask, popups } = permissionsWithPopups(t);
  void ask("git push origin main");
  assert.match(popups.latest().content.warning, /Allow counts as saying "confirm push"/);
});

test("popups: the explanation reaches the open pop-up", async (t) => {
  const { ask, popups } = permissionsWithPopups(t);
  void ask("git push origin main");
  await settle();
  assert.equal(popups.latest().explanation, EXPLANATION);
});

test("popups: Allow allows a destructive request once, without the spoken phrase", async (t) => {
  const { ask, popups } = permissionsWithPopups(t);
  const result = ask("git push origin main");
  popups.latest().click(true);
  assert.deepEqual(await result, { behavior: "allow" });
});

test("popups: Deny denies the request", async (t) => {
  const { ask, popups } = permissionsWithPopups(t);
  const result = ask("npm test");
  popups.latest().click(false);
  assert.equal((await result).behavior, "deny");
});

test("popups: answering elsewhere closes the pop-up", (t) => {
  const { ask, answers, popups, waiting } = permissionsWithPopups(t);
  void ask("npm test");
  answers.denyBySpeech(waiting.all()[0].id);
  assert.equal(popups.latest().closed, true);
});

test("popups: a reminder doesn't open a second pop-up", (t) => {
  const { ask, popups, waiting, events } = permissionsWithPopups(t);
  void ask("npm test");
  const { id, project, session, description } = waiting.all()[0];
  events.emitEvent({ kind: "permission", id, project, session, label: project, description, reminder: true });
  assert.equal(popups.shown.length, 1);
});
