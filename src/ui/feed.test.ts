import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { ConversationLines } from "../orchestrator/conversation/conversation-lines.js";
import { Feed } from "./feed.js";

let stateDir = "";

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "vo-feed-"));
  setStateDir(stateDir);
});

test("assistant chat survives a restart", () => {
  new Feed().add({ kind: "user", text: "run tests in webshop" });
  assert.deepEqual(
    new Feed().recent().map((e) => e.text),
    ["run tests in webshop"],
  );
});

test("entry ids keep counting after a restart", () => {
  new Feed().add({ kind: "user", text: "first" });
  const restarted = new Feed();
  restarted.add({ kind: "orchestrator", text: "second" });
  assert.deepEqual(
    restarted.recent().map((e) => e.id),
    [1, 2],
  );
});

test("clearing empties the chat for good", () => {
  const feed = new Feed();
  feed.add({ kind: "user", text: "hello" });
  feed.clear();
  assert.deepEqual(new Feed().recent(), []);
});

test("a line cut short by a crash doesn't lose the rest", () => {
  new Feed().add({ kind: "user", text: "kept" });
  appendFileSync(join(stateDir, "feed.jsonl"), '{"id":2,"kind":"us');
  assert.deepEqual(
    new Feed().recent().map((e) => e.text),
    ["kept"],
  );
});

const PREWINS_22 = { project: "prewins", id: "s-22", number: 22 };

test("an assistant line relaying a worker's answer links to its session, after a restart too", () => {
  const lines = new ConversationLines();
  new Feed().follow(lines, new AppEvents());
  lines.say({ role: "orchestrator", text: "Tests pass.", session: PREWINS_22 });
  assert.deepEqual(new Feed().recent()[0].session, PREWINS_22);
});

test("a finished task's line links to its session", () => {
  const events = new AppEvents();
  const feed = new Feed();
  feed.follow(new ConversationLines(), events);
  const subject = { project: "prewins", session: "s-22", label: "prewins", task: "run tests", sessionNumber: 22 };
  events.emitEvent({ kind: "task_done", ...subject, result: "All green." });
  assert.deepEqual(feed.recent()[0].session, PREWINS_22);
});
