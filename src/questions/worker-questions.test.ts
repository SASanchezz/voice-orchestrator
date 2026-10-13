import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { DESTRUCTIVE_PATH, setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { PermissionAnnouncer } from "../permissions/permission-announcer.js";
import { PermissionBroker } from "../permissions/permission-broker.js";
import { PermissionPolicy } from "../permissions/permission-policy.js";
import { WaitingRequests } from "../permissions/waiting-requests.js";
import { openRegistry } from "../registry/open-registry.js";
import { DestructiveList } from "../safety/destructive-list.js";
import { ToolCallGate } from "../workers/tool-call-gate.js";
import { QuestionBroker } from "./question-broker.js";
import { QUESTION_TOOL } from "./question-input.js";
import { QuestionReplies } from "./question-replies.js";
import { WaitingQuestions } from "./waiting-questions.js";

const tmp = mkdtempSync(join(tmpdir(), "vo-questions-"));
setStateDir(tmp);
const rulesFile = join(tmp, "destructive.yaml");
copyFileSync(DESTRUCTIVE_PATH, rulesFile);
const settings = { mode: "auto", reminderMinutes: 60, alwaysDestination: "localSettings" } as const;
const DATABASE = "Which database?";
const INPUT = {
  questions: [
    {
      question: DATABASE,
      header: "Database",
      multiSelect: false,
      options: [
        { label: "Postgres", description: "Robust" },
        { label: "SQLite", description: "Simple" },
      ],
    },
  ],
};

const settle = () => new Promise((r) => setImmediate(r));

/** One project's worker asking through the gate, in auto mode. Questions still waiting when the test ends are stopped. */
function questions(t: TestContext) {
  const events = new AppEvents();
  const { sessions, registry } = openRegistry({ webshop: "personal" }, events);
  const policy = new PermissionPolicy("auto", new DestructiveList(rulesFile));
  const permissions = new PermissionBroker(
    policy,
    new WaitingRequests(sessions, new PermissionAnnouncer(sessions, events, settings)),
  );
  const waiting = new WaitingQuestions(sessions, events);
  const replies = new QuestionReplies(waiting, sessions);
  const session = registry.activeSession("webshop");
  const canUseTool = new ToolCallGate(permissions, new QuestionBroker(waiting)).forSession(session.id);
  const stop = new AbortController();
  t.after(() => stop.abort());
  const options = { signal: stop.signal, toolUseID: "t", requestId: "r" };
  const ask = (input: Record<string, unknown> = INPUT): Promise<PermissionResult | null> =>
    canUseTool(QUESTION_TOOL, input, options);
  const runTool = (toolName: string, input: Record<string, unknown>) => canUseTool(toolName, input, options);
  return { ask, runTool, waiting, replies, sessions, session, stop };
}

function onlyId(waiting: WaitingQuestions): string {
  const [pending] = waiting.all();
  return pending.id;
}

test("questions: they wait for you even in auto mode", async (t) => {
  const { ask, waiting } = questions(t);
  let answered = false;
  void ask().then(() => (answered = true));
  await settle();
  assert.deepEqual([answered, waiting.all().length], [false, 1]);
});

test("questions: your answer goes back to the worker in its input", async (t) => {
  const { ask, waiting, replies } = questions(t);
  const result = ask();
  replies.answer(onlyId(waiting), { [DATABASE]: "Postgres" });
  assert.deepEqual(await result, {
    behavior: "allow",
    updatedInput: { ...INPUT, answers: { [DATABASE]: "Postgres" } },
  });
});

test("questions: answering says what was answered", (t) => {
  const { ask, waiting, replies } = questions(t);
  void ask();
  assert.equal(replies.answer(onlyId(waiting), { [DATABASE]: " SQLite " }), `Answered webshop: "${DATABASE}" → SQLite`);
});

test("questions: an unanswered question is refused and keeps waiting", (t) => {
  const { ask, waiting, replies } = questions(t);
  void ask();
  replies.answer(onlyId(waiting), { [DATABASE]: "  " });
  assert.equal(waiting.all().length, 1);
});

test("questions: skipping tells the worker to carry on without answers", async (t) => {
  const { ask, waiting, replies } = questions(t);
  const result = ask();
  replies.skip(onlyId(waiting));
  assert.equal((await result)?.behavior, "deny");
});

test("questions: stopping the worker ends its questions", async (t) => {
  const { ask, stop } = questions(t);
  const result = ask();
  stop.abort();
  assert.deepEqual(await result, { behavior: "deny", message: "Run was stopped." });
});

test("questions: questions it can't read are refused at once, asking for plain text", async (t) => {
  const { ask } = questions(t);
  const result = await ask({ questions: [] });
  assert.match(result?.behavior === "deny" ? result.message : "", /plain text/);
});

test("questions: the session waits for you while asked", (t) => {
  const { ask, sessions, session } = questions(t);
  void ask();
  assert.equal(sessions.session(session.id).status, "waiting_permission");
});

test("questions: once answered, the session runs again", (t) => {
  const { ask, waiting, replies, sessions, session } = questions(t);
  sessions.updateSession(session.id, { status: "running" });
  void ask();
  replies.answer(onlyId(waiting), { [DATABASE]: "Postgres" });
  assert.equal(sessions.session(session.id).status, "running");
});

test("questions: other tools still follow the permission mode", async (t) => {
  const { runTool } = questions(t);
  assert.deepEqual(await runTool("Bash", { command: "npm test" }), { behavior: "allow" });
});
