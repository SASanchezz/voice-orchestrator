import { test } from "node:test";
import assert from "node:assert/strict";
import { SingleVoice } from "./single-voice.js";

test("single voice: a reply that speaks first keeps the voice", () => {
  const voice = new SingleVoice();
  assert.deepEqual([voice.replyMaySpeak(), voice.replyMaySpeak(), voice.claimForFallback()], [true, true, false]);
});

test("single voice: once the fallback has spoken, the late reply stays silent", () => {
  const voice = new SingleVoice();
  assert.deepEqual([voice.claimForFallback(), voice.replyMaySpeak()], [true, false]);
});

test("single voice: the fallback is said only once", () => {
  const voice = new SingleVoice();
  assert.deepEqual([voice.claimForFallback(), voice.claimForFallback()], [true, false]);
});

test("single voice: nothing has been said until someone speaks", () => {
  assert.equal(new SingleVoice().hasSpoken(), false);
});

test("single voice: once silenced, neither the reply nor the fallback may speak", () => {
  const voice = new SingleVoice();
  voice.silence();
  assert.deepEqual([voice.replyMaySpeak(), voice.claimForFallback()], [false, false]);
});

test("single voice: silencing it while it speaks stops the speech", () => {
  let stops = 0;
  const voice = new SingleVoice(() => stops++);
  voice.replyMaySpeak();
  voice.silence();
  assert.equal(stops, 1);
});

test("single voice: silencing it stops whatever is playing, as the talk key does, even before its turn", () => {
  let stops = 0;
  new SingleVoice(() => stops++).silence();
  assert.equal(stops, 1);
});
