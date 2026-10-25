import { test } from "node:test";
import assert from "node:assert/strict";
import { TalkSwitch } from "./talk-switch.js";
import type { VoiceInputState } from "./voice-io.js";

/** Stands in for push-to-talk; it writes down what it's asked to do. */
class FakeRecorder {
  private current: VoiceInputState = "idle";

  constructor(private done: string[]) {}

  begin(): void {
    this.done.push("begin");
    this.current = "recording";
  }

  release(): void {
    this.done.push("release");
    this.current = "idle";
  }

  discard(): void {
    this.done.push("discard");
    this.current = "idle";
  }

  state(): VoiceInputState {
    return this.current;
  }
}

function talkSwitch(): { talk: TalkSwitch; done: string[] } {
  const done: string[] = [];
  const talk = new TalkSwitch(new FakeRecorder(done), () => done.push("stopSpeaking"));
  talk.onPress(() => done.push("pressed"));
  return { talk, done };
}

test("talk switch: pressing interrupts the reply, reports the press, then records", () => {
  const { talk, done } = talkSwitch();
  talk.press("gesture");
  assert.deepEqual(done, ["stopSpeaking", "pressed", "begin"]);
});

test("talk switch: a gesture can't start talking while the hotkey is held", () => {
  const { talk, done } = talkSwitch();
  talk.press("hotkey");
  talk.press("gesture");
  assert.equal(done.filter((step) => step === "begin").length, 1);
});

test("talk switch: lowering a gesture doesn't end the hotkey's recording", () => {
  const { talk, done } = talkSwitch();
  talk.press("hotkey");
  talk.release("gesture");
  assert.equal(done.includes("release"), false);
});

test("talk switch: the hotkey can't end a gesture's recording", () => {
  const { talk, done } = talkSwitch();
  talk.press("gesture");
  talk.release("hotkey");
  assert.equal(done.includes("release"), false);
});

test("talk switch: once released, the other source can talk", () => {
  const { talk, done } = talkSwitch();
  talk.press("hotkey");
  talk.release("hotkey");
  talk.press("gesture");
  assert.equal(done.filter((step) => step === "begin").length, 2);
});

test("talk switch: cancelling drops the holder's recording", () => {
  const { talk, done } = talkSwitch();
  talk.press("hotkey");
  talk.cancel("hotkey");
  assert.equal(done.at(-1), "discard");
});

test("talk switch: after a discarded recording, a new press records again", () => {
  const { talk, done } = talkSwitch();
  talk.press("gesture");
  talk.cancel("gesture");
  talk.press("gesture");
  assert.equal(done.filter((step) => step === "begin").length, 2);
});
