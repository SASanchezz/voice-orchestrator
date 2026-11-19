import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import { testConfig } from "../testing/test-config.js";
import type { RunningTask } from "./running-task.js";
import { SideQuestions } from "./side-questions.js";
import { type SessionMessage, WorkerChat } from "./worker-chat.js";
import { WorkerDirectory } from "./worker-directory.js";

type Answer = (task: RunningTask) => Promise<string>;

function askWith(answer: Answer) {
  setStateDir(mkdtempSync(join(tmpdir(), "vo-btw-")));
  const { registry, projects, sessions } = openRegistry({ webshop: "personal" }, new AppEvents());
  const { id } = registry.activeSession("webshop");
  sessions.updateSession(id, { claudeSessionId: "claude-1" });
  const cfg = testConfig({ projects: { webshop: { path: "/w", profile: "personal" } } });
  const chat = new WorkerChat();
  const said: SessionMessage[] = [];
  chat.on("message", (m: SessionMessage) => said.push(m));
  const questions = new SideQuestions(new WorkerDirectory(cfg, projects, sessions), { answer }, chat);
  return { questions, id, said };
}

const settled = (): Promise<void> => new Promise((done) => setImmediate(done));

test("side questions: the typed line shows in the chat as sent", () => {
  const { questions, id, said } = askWith(() => Promise.resolve("Yes."));
  questions.ask(id, "/btw is it done?", "is it done?");
  assert.deepEqual(said[0], { session: id, kind: "task", text: "/btw is it done?" });
});

test("side questions: the answer arrives in the chat as a reply", async () => {
  const { questions, id, said } = askWith(() => Promise.resolve("Yes."));
  questions.ask(id, "/btw is it done?", "is it done?");
  await settled();
  assert.deepEqual(said[1], { session: id, kind: "reply", text: "Yes." });
});

test("side questions: the answer comes from the session's own conversation", async () => {
  const asked: RunningTask[] = [];
  const { questions, id } = askWith((task) => (asked.push(task), Promise.resolve("Yes.")));
  questions.ask(id, "/btw is it done?", "is it done?");
  await settled();
  assert.equal(asked[0].resume, "claude-1");
});

test("side questions: a failed answer shows as a failure", async () => {
  const { questions, id, said } = askWith(() => Promise.reject(new Error("no answer")));
  questions.ask(id, "/btw is it done?", "is it done?");
  await settled();
  assert.deepEqual(said[1], { session: id, kind: "status", text: "no answer", failed: true });
});
