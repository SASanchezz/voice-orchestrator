import assert from "node:assert/strict";
import { test } from "node:test";
import type { VoiceApprovals } from "./approval-voice.js";
import { VoiceAnswerChain } from "./voice-answer-chain.js";

function answering(phrase: string, reply: string): VoiceApprovals {
  return { canAnswer: (words) => words === phrase, answer: () => reply };
}

const CHAIN = new VoiceAnswerChain([answering("allow", "Allowed."), answering("confirm send", "Sending.")]);

test("voice answer chain: any answerer that can answer makes the chain answer", () => {
  assert.equal(CHAIN.canAnswer("confirm send"), true);
});

test("voice answer chain: words no answerer knows go on", () => {
  assert.equal(CHAIN.canAnswer("what's new"), false);
});

test("voice answer chain: the answerer that can answer does", () => {
  assert.equal(CHAIN.answer("confirm send", undefined), "Sending.");
});

test("voice answer chain: the first that can answer wins", () => {
  const chain = new VoiceAnswerChain([answering("allow", "first"), answering("allow", "second")]);
  assert.equal(chain.answer("allow", undefined), "first");
});
