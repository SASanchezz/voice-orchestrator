import { test } from "node:test";
import assert from "node:assert/strict";
import { AfterTalking } from "./after-talking.js";

/** You talk until `stopped` is set. */
function talkingVoice() {
  const voice = { stopped: false, isListening: () => !voice.stopped };
  return voice;
}

function whenAllRan(count: number, ran: string[]): Promise<void> {
  return new Promise((resolve) => {
    const check = setInterval(() => {
      if (ran.length < count) return;
      clearInterval(check);
      resolve();
    }, 10);
  });
}

test("after talking: runs right away while you're quiet", () => {
  const ran: string[] = [];
  new AfterTalking({ isListening: () => false }).run(() => ran.push("notice"));
  assert.deepEqual(ran, ["notice"]);
});

test("after talking: waits while you talk", () => {
  const voice = talkingVoice();
  const ran: string[] = [];
  new AfterTalking(voice).run(() => ran.push("notice"));
  const ranWhileTalking = [...ran];
  voice.stopped = true;
  assert.deepEqual(ranWhileTalking, []);
});

test("after talking: what waited runs in order once you stop", async () => {
  const voice = talkingVoice();
  const afterTalking = new AfterTalking(voice);
  const ran: string[] = [];
  afterTalking.run(() => ran.push("first"));
  afterTalking.run(() => ran.push("second"));
  voice.stopped = true;
  await whenAllRan(2, ran);
  assert.deepEqual(ran, ["first", "second"]);
});
