import assert from "node:assert/strict";
import { test } from "node:test";
import { fakeQuery } from "../../testing/fake-query.js";
import { scriptedModel, TWO_ACCOUNTS } from "../../testing/scripted-model.js";
import { ToolFreeModel, type ModelRole } from "./tool-free-model.js";

const ROLE: ModelRole = { name: "tester", model: "haiku", systemPrompt: "Rules." };

test("tool-free model: returns the answer, trimmed", async () => {
  const { model } = scriptedModel(() => "  hello ");
  assert.equal(await model.ask(ROLE, "work", "hi"), "hello");
});

test("tool-free model: runs on the given account", async () => {
  const { model, calls } = scriptedModel(() => "ok");
  await model.ask(ROLE, "work", "hi");
  assert.equal(calls[0].options?.env?.CLAUDE_CONFIG_DIR, "/w");
});

test("tool-free model: a fresh session with no tools, no settings and nothing on disk", async () => {
  const { model, calls } = scriptedModel(() => "ok");
  await model.ask(ROLE, "work", "hi");
  const { tools, settingSources, persistSession, model: modelName } = calls[0].options ?? {};
  assert.deepEqual(
    { tools, settingSources, persistSession, modelName },
    {
      tools: [],
      settingSources: [],
      persistSession: false,
      modelName: "haiku",
    },
  );
});

test("tool-free model: a stopped run says so", async () => {
  const query = fakeQuery(async function* () {
    yield { type: "result", subtype: "error_max_turns" };
  });
  await assert.rejects(new ToolFreeModel(TWO_ACCOUNTS, query).ask(ROLE, "work", "hi"), /tester stopped/);
});

test("tool-free model: no answer at all says so", async () => {
  const query = fakeQuery(async function* () {});
  await assert.rejects(new ToolFreeModel(TWO_ACCOUNTS, query).ask(ROLE, "work", "hi"), /tester gave no answer/);
});
