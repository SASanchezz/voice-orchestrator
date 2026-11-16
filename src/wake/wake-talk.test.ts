import { test } from "node:test";
import assert from "node:assert/strict";
import type { TalkSource } from "../voice/shared-mic.js";
import { WakeTalk } from "./wake-talk.js";

const SCORE = 0.9;

/** Stands in for the shared mic; it writes down what it was asked to do, and by whom. */
class FakeMic {
  done: string[] = [];

  start(source: TalkSource): void {
    this.done.push(`start ${source}`);
  }

  release(source: TalkSource): void {
    this.done.push(`release ${source}`);
  }
}

function wakeTalk(busy: boolean): { wake: WakeTalk; mic: FakeMic } {
  const mic = new FakeMic();
  return { wake: new WakeTalk(mic, () => busy), mic };
}

test("wake talk: hearing the wake word starts a recording as the wake word", () => {
  const { wake, mic } = wakeTalk(false);
  wake.heard(SCORE);
  assert.deepEqual(mic.done, ["start wake"]);
});

test("wake talk: the wake word is ignored while busy", () => {
  const { wake, mic } = wakeTalk(true);
  wake.heard(SCORE);
  assert.deepEqual(mic.done, []);
});

test("wake talk: a listener that stops mid-message ends the recording", () => {
  const { wake, mic } = wakeTalk(false);
  wake.sensorStopped();
  assert.deepEqual(mic.done, ["release wake"]);
});
