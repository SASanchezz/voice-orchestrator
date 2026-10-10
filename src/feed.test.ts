import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "./config.js";
import { Feed } from "./ui/feed.js";

let stateDir = "";

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "vo-feed-"));
  setStateDir(stateDir);
});

test("assistant chat survives a restart", () => {
  new Feed().add({ kind: "user", text: "run tests in webshop" });
  assert.deepEqual(new Feed().recent().map((e) => e.text), ["run tests in webshop"]);
});

test("entry ids keep counting after a restart", () => {
  new Feed().add({ kind: "user", text: "first" });
  const restarted = new Feed();
  restarted.add({ kind: "orchestrator", text: "second" });
  assert.deepEqual(restarted.recent().map((e) => e.id), [1, 2]);
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
  assert.deepEqual(new Feed().recent().map((e) => e.text), ["kept"]);
});
