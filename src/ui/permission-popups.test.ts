import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { DEFAULT_PROTECTED_BRANCHES } from "../config/app-config.js";
import { DESTRUCTIVE_PATH, setStateDir } from "../config/paths.js";
import { AppEvents, type AppEvent } from "../events/app-events.js";
import { EditScope } from "../permissions/edit-scope.js";
import { PermissionAnnouncer } from "../permissions/permission-announcer.js";
import { PermissionAnswers } from "../permissions/permission-answers.js";
import { PermissionBroker } from "../permissions/permission-broker.js";
import { PermissionExplanations } from "../permissions/permission-explanations.js";
import { PermissionPolicy } from "../permissions/permission-policy.js";
import { WaitingRequests } from "../permissions/waiting-requests.js";
import { openRegistry } from "../registry/open-registry.js";
import type { Sessions } from "../registry/sessions.js";
import { DestructiveList } from "../safety/destructive-list.js";
import { TestPopups } from "../testing/test-popups.js";
import { workerRules } from "../testing/test-worker-rules.js";
import { PermissionPopups } from "./permission-popups.js";

const tmp = mkdtempSync(join(tmpdir(), "vo-popups-"));
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
const EXPLANATION = "Pushes your commits to GitHub. Risk: medium.";

/** One project's permissions with pop-ups, wired as in the app. Requests still waiting when the test ends are stopped. */
function permissionsWithPopups(t: TestContext) {
  const events = new AppEvents();
  const { sessions, registry } = openRegistry({ webshop: "personal" }, events);
  const { broker, waiting, answers } = askingPermissions(sessions, events);
  const popups = new TestPopups();
  const silenced: AppEvent[] = [];
  const popupsFollowing = new PermissionPopups(popups, answers, { silence: (e) => void silenced.push(e) });
  popupsFollowing.follow(events);
  const stop = new AbortController();
  t.after(() => stop.abort());
  const { id: session } = registry.activeSession("webshop");
  const ask = (command: string): Promise<PermissionResult> =>
    broker.request(session, { toolName: "Bash", input: { command } }, { signal: stop.signal });
  return { ask, answers, popups, popupsFollowing, waiting, events, silenced };
}

/** Permissions in ask mode, explained at once, as the app wires them. */
function askingPermissions(sessions: Sessions, events: AppEvents) {
  const announcer = new PermissionAnnouncer(sessions, events, settings);
  const waiting = new WaitingRequests(sessions, announcer);
  const explanations = new PermissionExplanations(waiting, async () => EXPLANATION, announcer);
  const policy = new PermissionPolicy("ask", workerRules(rules), new EditScope(() => tmpdir()));
  const broker = new PermissionBroker(policy, waiting, explanations);
  const answers = new PermissionAnswers(waiting, sessions, settings);
  return { broker, waiting, answers };
}

const settle = () => new Promise((r) => setImmediate(r));

test("popups: a waiting request opens a pop-up naming the asker and the command", (t) => {
  const { ask, popups } = permissionsWithPopups(t);
  void ask("npm test");
  assert.deepEqual(popups.latest().content, {
    title: "webshop asks permission",
    warning: "",
    command: "Bash: npm test",
    wholeCommand: "",
    allowLabel: "Allow once",
  });
});

test("popups: a click anywhere in a pop-up stops what is said about its request", (t) => {
  const { ask, popups, silenced } = permissionsWithPopups(t);
  void ask("npm test");
  popups.latest().clickInside();
  assert.deepEqual(
    silenced.map((e) => e.label),
    ["webshop"],
  );
});

const LONG_SCRIPT = `cd /repo; set -e\n${"git ls-remote --exit-code origin refs/heads/feature\n".repeat(10)}`;

test("popups: a long command's pop-up shows it at a glance", (t) => {
  const { ask, popups } = permissionsWithPopups(t);
  void ask(LONG_SCRIPT);
  assert.match(popups.latest().content.command, /^Bash: cd \/repo; set -e git ls-remote .*…$/);
});

test("popups: a long command's pop-up has the whole command, uncut", (t) => {
  const { ask, popups } = permissionsWithPopups(t);
  void ask(LONG_SCRIPT);
  assert.equal(popups.latest().content.wholeCommand, `Bash: ${LONG_SCRIPT}`);
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
  const { id, project, session, description, command } = waiting.all()[0];
  events.emitEvent({ kind: "permission", id, project, session, label: project, description, command, reminder: true });
  assert.equal(popups.shown.length, 1);
});

test("popups: an open destructive pop-up asks for its verb", (t) => {
  const { ask, popupsFollowing } = permissionsWithPopups(t);
  void ask("git push origin main");
  assert.equal(popupsFollowing.isAsking("push"), true);
});

test("popups: a closed pop-up no longer asks for its verb", (t) => {
  const { ask, answers, popupsFollowing, waiting } = permissionsWithPopups(t);
  void ask("git push origin main");
  answers.denyBySpeech(waiting.all()[0].id);
  assert.equal(popupsFollowing.isAsking("push"), false);
});
