import assert from "node:assert/strict";
import { test } from "node:test";
import { promptOf, scriptedModel } from "../../testing/scripted-model.js";
import type { Triage } from "./reply-triage.js";
import { writtenReply } from "./reply-writer.js";

const QUESTION: Triage = { needsReply: true, kind: "question", urgency: "normal" };

async function promptFor(triage: Triage, note?: string): Promise<string> {
  const { model, calls } = scriptedModel(() => "Sure!");
  await writtenReply(model, "work", { quoted: "QUOTED", triage, note });
  return promptOf(calls[0]);
}

test("reply writer: the draft is written on Sonnet", async () => {
  const { model, calls } = scriptedModel(() => "Sure!");
  await writtenReply(model, "work", { quoted: "QUOTED", triage: QUESTION });
  assert.equal(calls[0].options?.model, "sonnet");
});

test("reply writer: the reply is the model's answer", async () => {
  const { model } = scriptedModel(() => "Sure!");
  assert.equal(await writtenReply(model, "work", { quoted: "QUOTED", triage: QUESTION }), "Sure!");
});

test("reply writer: the prompt quotes the conversation", async () => {
  assert.ok((await promptFor(QUESTION)).startsWith("QUOTED"));
});

test("reply writer: the chat's note guides the draft", async () => {
  assert.ok((await promptFor(QUESTION, "formal, English")).includes("The user's note for this chat: formal, English"));
});

test("reply writer: a code question gets a holding reply, not an answer", async () => {
  const prompt = await promptFor({ ...QUESTION, kind: "code-question" });
  assert.ok(prompt.includes("Don't answer the technical question"));
});
