import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PermissionMode } from "../config/app-config.js";
import { DEFAULT_PROTECTED_BRANCHES } from "../config/app-config.js";
import { DESTRUCTIVE_PATH, setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import { DestructiveList } from "../safety/destructive-list.js";
import { workerRules } from "../testing/test-worker-rules.js";
import { EditScope } from "./edit-scope.js";
import { PermissionAnnouncer } from "./permission-announcer.js";
import { PermissionBroker } from "./permission-broker.js";
import { PermissionPolicy } from "./permission-policy.js";
import { PermissionReview } from "./permission-review.js";
import type { ReviewCommand } from "./permission-types.js";
import { ReviewedRequests } from "./reviewed-requests.js";
import { WaitingRequests } from "./waiting-requests.js";

const tmp = mkdtempSync(join(tmpdir(), "vo-review-"));
setStateDir(tmp);
const rulesFile = join(tmp, "destructive.yaml");
copyFileSync(DESTRUCTIVE_PATH, rulesFile);
const rules = new DestructiveList(rulesFile);
const settings = {
  mode: "auto",
  reminderMinutes: 60,
  alwaysDestination: "localSettings",
  protectedBranches: DEFAULT_PROTECTED_BRANCHES,
} as const;

const allowing: ReviewCommand = () => Promise.resolve({ allow: true, reason: "build output" });
const declining: ReviewCommand = () => Promise.resolve({ allow: false, reason: "unsure" });
const failing: ReviewCommand = () => Promise.reject(new Error("model down"));

/** One project's broker with a review, wired as in the app; `reviewed` counts the calls the reviewer saw. */
function brokerReviewing(t: TestContext, review: ReviewCommand, mode: PermissionMode = "auto") {
  const events = new AppEvents();
  const { sessions, registry } = openRegistry({ webshop: "personal" }, events);
  const policy = new PermissionPolicy(mode, workerRules(rules), new EditScope(() => tmp));
  const waiting = new WaitingRequests(sessions, new PermissionAnnouncer(sessions, events, settings));
  const reviewed: string[] = [];
  const counting: ReviewCommand = (project, call, rule) => {
    reviewed.push(project);
    return review(project, call, rule);
  };
  const reviewing = new PermissionReview(sessions, counting);
  const broker = new ReviewedRequests(policy, reviewing, new PermissionBroker(policy, waiting));
  const session = registry.activeSession("webshop");
  const stop = new AbortController();
  t.after(() => stop.abort());
  const ask = (command: string) =>
    broker.request(session.id, { toolName: "Bash", input: { command } }, { signal: stop.signal });
  return { ask, reviewed, session };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("review: a call the reviewer passes runs without asking", async (t) => {
  const { ask } = brokerReviewing(t, allowing);
  assert.deepEqual(await ask("rm -rf dist"), { behavior: "allow" });
});

test("review: a call the reviewer doesn't pass waits for you", async (t) => {
  const { ask, session } = brokerReviewing(t, declining);
  void ask("rm -rf dist");
  await settle();
  assert.equal(session.status, "waiting_permission");
});

test("review: a failed review waits for you", async (t) => {
  const { ask, session } = brokerReviewing(t, failing);
  void ask("rm -rf dist");
  await settle();
  assert.equal(session.status, "waiting_permission");
});

test("review: an always-ask rule never reaches the reviewer", async (t) => {
  const { ask, reviewed } = brokerReviewing(t, allowing);
  void ask("git push origin main");
  await settle();
  assert.deepEqual(reviewed, []);
});

test("review: in ask mode nothing reaches the reviewer", async (t) => {
  const { ask, reviewed } = brokerReviewing(t, allowing, "ask");
  void ask("rm -rf dist");
  await settle();
  assert.deepEqual(reviewed, []);
});
