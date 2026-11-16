import { test } from "node:test";
import assert from "node:assert/strict";
import type { TalkSource } from "../voice/talk-switch.js";
import { WakeTalk } from "./wake-talk.js";

const SCORE = 0.9;

/** Stands in for the mic switch; it writes down what it was asked to do, and by whom. */
class FakeTalk {
  done: string[] = [];

  press(source: TalkSource): void {
    this.done.push(`press ${source}`);
  }

  release(source: TalkSource): void {
    this.done.push(`release ${source}`);
  }
}

function wakeTalk(busy: boolean): { wake: WakeTalk; talk: FakeTalk } {
  const talk = new FakeTalk();
  return { wake: new WakeTalk(talk, () => busy), talk };
}

test("wake talk: hearing the wake word starts a recording as the wake word", () => {
  const { wake, talk } = wakeTalk(false);
  wake.heard(SCORE);
  assert.deepEqual(talk.done, ["press wake"]);
});

test("wake talk: the wake word is ignored while busy", () => {
  const { wake, talk } = wakeTalk(true);
  wake.heard(SCORE);
  assert.deepEqual(talk.done, []);
});

test("wake talk: a listener that stops mid-message ends the recording", () => {
  const { wake, talk } = wakeTalk(false);
  wake.sensorStopped();
  assert.deepEqual(talk.done, ["release wake"]);
});
