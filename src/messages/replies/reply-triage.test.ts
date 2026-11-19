import assert from "node:assert/strict";
import { test } from "node:test";
import { scriptedModel } from "../../testing/scripted-model.js";
import { readTriage, triageOf } from "./reply-triage.js";

const CODE_QUESTION = '{"needsReply": true, "kind": "code-question", "urgency": "high"}';

test("reply triage: a well-formed answer is read", () => {
  assert.deepEqual(readTriage(CODE_QUESTION), { needsReply: true, kind: "code-question", urgency: "high" });
});

test("reply triage: text around the JSON is ignored", () => {
  assert.equal(readTriage(`Sure: ${CODE_QUESTION} done`).kind, "code-question");
});

test("reply triage: an unknown kind falls back to drafting a reply", () => {
  const answer = '{"needsReply": false, "kind": "send-money", "urgency": "high"}';
  assert.deepEqual(readTriage(answer), { needsReply: true, kind: "chat", urgency: "normal" });
});

test("reply triage: an answer without JSON falls back to drafting a reply", () => {
  assert.equal(readTriage("no idea").needsReply, true);
});

test("reply triage: broken JSON falls back to drafting a reply", () => {
  assert.equal(readTriage('{"needsReply": tru').needsReply, true);
});

test("reply triage: sorting runs on Haiku", async () => {
  const { model, calls } = scriptedModel(() => CODE_QUESTION);
  await triageOf(model, "work", "quoted");
  assert.equal(calls[0].options?.model, "haiku");
});
