import { test } from "node:test";
import assert from "node:assert/strict";
import { HotkeyTalk } from "./hotkey-talk.js";
import { MacHotkey } from "./hotkey.js";
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

function hotkeyTalk(): { hotkey: HotkeyTalk; talk: TalkSwitch; done: string[] } {
  const done: string[] = [];
  const talk = new TalkSwitch(new FakeRecorder(done), () => {});
  return { hotkey: new HotkeyTalk(new MacHotkey("RIGHT ALT"), talk), talk, done };
}

test("hotkey talk: the first press starts recording", () => {
  const { hotkey, done } = hotkeyTalk();
  hotkey.toggle();
  assert.deepEqual(done, ["begin"]);
});

test("hotkey talk: the second press sends the recording", () => {
  const { hotkey, done } = hotkeyTalk();
  hotkey.toggle();
  hotkey.toggle();
  assert.deepEqual(done, ["begin", "release"]);
});

test("hotkey talk: a third press starts a new recording", () => {
  const { hotkey, done } = hotkeyTalk();
  hotkey.toggle();
  hotkey.toggle();
  hotkey.toggle();
  assert.equal(done.at(-1), "begin");
});

test("hotkey talk: after Escape discards it, the next press starts recording again", () => {
  const { hotkey, talk, done } = hotkeyTalk();
  hotkey.toggle();
  talk.cancel();
  hotkey.toggle();
  assert.equal(done.at(-1), "begin");
});

test("hotkey talk: a press during the wake word's recording doesn't end it", () => {
  const { hotkey, talk, done } = hotkeyTalk();
  talk.press("wake");
  hotkey.toggle();
  assert.deepEqual(done, ["begin"]);
});
