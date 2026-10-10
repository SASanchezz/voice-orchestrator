import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "./config.js";
import { ConversationMemory } from "./memory.js";
import { Registry } from "./registry.js";

setStateDir(mkdtempSync(join(tmpdir(), "vo-memory-")));

test("conversation survives a restart", () => {
  new ConversationMemory().record("user: run tests in webshop", "Started on webshop.");
  assert.match(new ConversationMemory().recap(), /run tests in webshop -> you said: Started on webshop/);
});

test("starting over keeps only the handoff", () => {
  const memory = new ConversationMemory();
  memory.record("user: hello", "Hi.");
  memory.startOver("User prefers short answers.");
  assert.equal(new ConversationMemory().recap(), "Handoff from your previous session (context was reset):\nUser prefers short answers.");
});

test("a fresh start leaves nothing to recap", () => {
  new ConversationMemory().startOver("");
  assert.equal(new ConversationMemory().recap(), "");
});

test("task history survives a restart", () => {
  const registry = new Registry({ webshop: "personal" });
  registry.recordTask(registry.activeSession("webshop").id, { task: "add rate limiting", outcome: "done", result: "Added a sliding window." });
  assert.match(new Registry({ webshop: "personal" }).historyOf("webshop"), /\[done\] add rate limiting\nResult: Added a sliding window\./);
});
