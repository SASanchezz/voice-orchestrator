import { test } from "node:test";
import assert from "node:assert/strict";
import { HotkeyTalk } from "./hotkey-talk.js";
import { MacHotkey } from "./hotkey.js";
import type { TalkSource } from "./shared-mic.js";
import type { VoiceInputState } from "./voice-io.js";

/** Stands in for the shared mic; it writes down what it's asked to do. */
class FakeMic {
  done: string[] = [];
  private current: VoiceInputState = "idle";

  start(source: TalkSource): void {
    this.done.push(`start ${source}`);
    this.current = "recording";
  }

  send(): Promise<void> {
    this.done.push("send");
    this.current = "idle";
    return Promise.resolve();
  }

  cancel(): Promise<void> {
    this.done.push("cancel");
    this.current = "idle";
    return Promise.resolve();
  }

  state(): VoiceInputState {
    return this.current;
  }
}

function hotkeyTalk(): { hotkey: HotkeyTalk; mic: FakeMic } {
  const mic = new FakeMic();
  return { hotkey: new HotkeyTalk(new MacHotkey("RIGHT ALT"), mic), mic };
}

test("hotkey talk: the first press starts recording", () => {
  const { hotkey, mic } = hotkeyTalk();
  hotkey.toggle();
  assert.deepEqual(mic.done, ["start hotkey"]);
});

test("hotkey talk: the second press sends the recording", () => {
  const { hotkey, mic } = hotkeyTalk();
  hotkey.toggle();
  hotkey.toggle();
  assert.deepEqual(mic.done, ["start hotkey", "send"]);
});

test("hotkey talk: a third press starts a new recording", () => {
  const { hotkey, mic } = hotkeyTalk();
  hotkey.toggle();
  hotkey.toggle();
  hotkey.toggle();
  assert.equal(mic.done.at(-1), "start hotkey");
});

test("hotkey talk: a press during the wake word's recording sends it", () => {
  const { hotkey, mic } = hotkeyTalk();
  mic.start("wake");
  hotkey.toggle();
  assert.equal(mic.done.at(-1), "send");
});

test("hotkey talk: a press during the mic button's recording sends it", () => {
  const { hotkey, mic } = hotkeyTalk();
  mic.start("button");
  hotkey.toggle();
  assert.equal(mic.done.at(-1), "send");
});
