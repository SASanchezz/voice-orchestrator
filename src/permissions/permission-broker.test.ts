import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PermissionResult, PermissionUpdate } from "@anthropic-ai/claude-agent-sdk";
import { DESTRUCTIVE_PATH, setStateDir } from "../config/paths.js";
import { AppEvents, type AppEvent } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import { DestructiveList } from "../safety/destructive-list.js";
import { PermissionAnnouncer } from "./permission-announcer.js";
import { PermissionAnswers } from "./permission-answers.js";
import { PermissionBroker } from "./permission-broker.js";
import { PermissionExplanations } from "./permission-explanations.js";
import { PermissionPolicy } from "./permission-policy.js";
import type { ExplainCommand } from "./permission-types.js";
import { PermissionViews } from "./permission-views.js";
import { WaitingRequests } from "./waiting-requests.js";

const tmp = mkdtempSync(join(tmpdir(), "vo-permissions-"));
setStateDir(tmp);
const rulesFile = join(tmp, "destructive.yaml");
copyFileSync(DESTRUCTIVE_PATH, rulesFile);
const rules = new DestructiveList(rulesFile);
const settings = { mode: "ask", reminderMinutes: 60, alwaysDestination: "localSettings" } as const;
const ALWAYS_SUGGESTION = {
  type: "addRules",
  rules: [{ toolName: "Bash", ruleContent: "npm test:*" }],
  behavior: "allow",
  destination: "session",
} as PermissionUpdate;

/** One project's permissions, wired as in the app. Requests still waiting when the test ends are stopped. */
function permissions(t: TestContext, explain?: ExplainCommand) {
  const events = new AppEvents();
  const { sessions, registry } = openRegistry({ webshop: "personal" }, events);
  const policy = new PermissionPolicy("ask", rules);
  const announcer = new PermissionAnnouncer(sessions, events, settings);
  const waiting = new WaitingRequests(sessions, announcer);
  const explanations = explain && new PermissionExplanations(waiting, explain, announcer);
  const broker = new PermissionBroker(policy, waiting, explanations);
  const session = registry.activeSession("webshop");
  const stop = new AbortController();
  t.after(() => stop.abort());
  const ask = (command: string, suggestions?: PermissionUpdate[]): Promise<PermissionResult> =>
    broker.request(session.id, { toolName: "Bash", input: { command } }, { suggestions, signal: stop.signal });
  const answers = new PermissionAnswers(waiting, sessions, settings);
  return { ask, answers, policy, events, session, stop, views: new PermissionViews(waiting, sessions, policy) };
}

const settle = () => new Promise((r) => setImmediate(r));

test("broker: a destructive request is announced with its confirm verb", (t) => {
  const { ask, events } = permissions(t);
  const announced: AppEvent[] = [];
  events.on("event", (e: AppEvent) => announced.push(e));
  void ask("git push origin main");
  assert.match(JSON.stringify(announced[0]), /"destructiveVerb":"push"/);
});

test("broker: a waiting request shows on its session", (t) => {
  const { ask, session } = permissions(t);
  void ask("git push origin main");
  assert.equal(session.status, "waiting_permission");
});

test("broker: a plain yes doesn't allow a destructive request", (t) => {
  const { ask, answers, views } = permissions(t);
  void ask("git push origin main");
  assert.match(answers.allowBySpeech(views.list()[0].id, "once", "yes go ahead"), /Not approved/);
});

test("broker: a destructive request can't be allowed always, even with the phrase", (t) => {
  const { ask, answers, views } = permissions(t);
  void ask("git push origin main");
  assert.match(answers.allowBySpeech(views.list()[0].id, "always", "confirm push"), /can't be always-allowed/);
});

test("broker: the confirm phrase allows a destructive request once", (t) => {
  const { ask, answers, views } = permissions(t);
  void ask("git push origin main");
  assert.match(answers.allowBySpeech(views.list()[0].id, "once", "confirm push"), /Allowed once/);
});

test("broker: an allowed request lets the worker go ahead", async (t) => {
  const { ask, answers, views } = permissions(t);
  const result = ask("git push origin main");
  answers.allowBySpeech(views.list()[0].id, "once", "confirm push");
  assert.deepEqual(await result, { behavior: "allow" });
});

test("broker: an answered request is no longer waiting", (t) => {
  const { ask, answers, views } = permissions(t);
  void ask("git push origin main");
  answers.allowBySpeech(views.list()[0].id, "once", "confirm push");
  assert.equal(views.list().length, 0);
});

test("broker: a normal request allowed 'always' is saved to local settings", async (t) => {
  const { ask, answers, views } = permissions(t);
  const result = ask("npm test", [ALWAYS_SUGGESTION]);
  answers.allowBySpeech(views.list()[0].id, "always", "always");
  const saved = await result;
  const [update] = (saved.behavior === "allow" && saved.updatedPermissions) || [];
  assert.equal(update && "destination" in update ? update.destination : undefined, "localSettings");
});

test("broker in auto mode allows normal commands without asking", async (t) => {
  const { ask, policy } = permissions(t);
  policy.setMode("auto");
  assert.deepEqual(await ask("npm test"), { behavior: "allow" });
});

test("broker in auto mode still asks for destructive commands", (t) => {
  const { ask, policy, views } = permissions(t);
  policy.setMode("auto");
  void ask("git push origin main");
  assert.equal(views.list()[0].destructive, 'yes - user must say "confirm push"');
});

test("broker: stopping a worker denies its pending request", async (t) => {
  const { ask, stop } = permissions(t);
  const result = ask("npm i");
  stop.abort();
  assert.equal((await result).behavior, "deny");
});

test("broker: an answered request is announced as closed", (t) => {
  const { ask, answers, events, views } = permissions(t);
  const closed: string[] = [];
  events.on("permission_closed", (id: string) => closed.push(id));
  void ask("npm test");
  const [{ id }] = views.list();
  answers.answerByClick(id, "deny");
  assert.deepEqual(closed, [id]);
});

// ------------------------------------------------------------------ plain-language explanations

test("explain: a destructive request shows it is being explained", (t) => {
  const { ask, views } = permissions(t, () => new Promise(() => {}));
  void ask("rm -rf tmp");
  assert.equal(views.requests()[0].explaining, true);
});

test("explain: the explanation is attached to the waiting request", async (t) => {
  const { ask, views } = permissions(t, async () => "Deletes the tmp folder. Low risk.");
  void ask("rm -rf tmp");
  await settle();
  const [request] = views.requests();
  assert.deepEqual([request.explanation, request.explaining], ["Deletes the tmp folder. Low risk.", false]);
});

test("explain: the explainer is given the project and the raw command", async (t) => {
  const asked: string[][] = [];
  const { ask } = permissions(t, async (project, command) => (asked.push([project, command]), "x"));
  void ask("rm -rf tmp");
  await settle();
  assert.deepEqual(asked, [["webshop", "rm -rf tmp"]]);
});

test("explain: a non-destructive request is explained too", async (t) => {
  const { ask, views } = permissions(t, async () => "Runs the tests. Risk: low.");
  void ask("npm test");
  await settle();
  assert.equal(views.requests()[0].explanation, "Runs the tests. Risk: low.");
});

test("explain: a written explanation is announced with its request", async (t) => {
  const { ask, events, views } = permissions(t, async () => "Runs the tests. Risk: low.");
  const explained: string[][] = [];
  events.on("permission_explained", (id: string, text: string) => explained.push([id, text]));
  void ask("npm test");
  await settle();
  assert.deepEqual(explained, [[views.list()[0].id, "Runs the tests. Risk: low."]]);
});

test("explain: a failed explanation leaves the request answerable, without text", async (t) => {
  const { ask, views } = permissions(t, async () => {
    throw new Error("offline");
  });
  void ask("rm -rf tmp");
  await settle();
  const [request] = views.requests();
  assert.deepEqual([request.explanation, request.explaining], [undefined, false]);
});
