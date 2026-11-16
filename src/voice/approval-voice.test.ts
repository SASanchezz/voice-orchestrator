import { test } from "node:test";
import assert from "node:assert/strict";
import { FrontSession } from "../ui/front-session.js";
import { ApprovalVoice, type VoiceApprovals } from "./approval-voice.js";
import { TextVoice } from "./text-voice.js";

const APPROVAL = "allow commit";
const REPLY = "Allowed, webshop.";

/** A voice whose finished words the test drives, and which keeps what it was asked to say. */
class DrivenVoice extends TextVoice {
  readonly spoken: string[] = [];
  private pressCallback: () => void = () => {};
  private utteranceCallback: (text: string) => void = () => {};

  override onPress(cb: () => void): void {
    this.pressCallback = cb;
  }

  override onUtterance(cb: (text: string) => void): void {
    this.utteranceCallback = cb;
  }

  override async speak(text: string): Promise<void> {
    this.spoken.push(text);
  }

  say(text: string): void {
    this.pressCallback();
    this.utteranceCallback(text);
  }
}

/** Approvals that answer only APPROVAL, and keep the session in front each was answered for. */
class TestApprovals implements VoiceApprovals {
  readonly answeredFor: (string | undefined)[] = [];

  canAnswer(words: string): boolean {
    return words === APPROVAL;
  }

  answer(_words: string, sessionInFront: string | undefined): string {
    this.answeredFor.push(sessionInFront);
    return REPLY;
  }
}

function listening(front = new FrontSession()) {
  const voice = new DrivenVoice();
  const approvals = new TestApprovals();
  const onward: string[] = [];
  const approvalVoice = new ApprovalVoice(voice, front, approvals);
  approvalVoice.onPress(() => {});
  approvalVoice.onUtterance((text) => onward.push(text));
  return { voice, approvals, onward };
}

test("approval voice: an approval goes no further", () => {
  const { voice, onward } = listening();
  voice.say(APPROVAL);
  assert.deepEqual(onward, []);
});

test("approval voice: an approval is answered aloud", () => {
  const { voice } = listening();
  voice.say(APPROVAL);
  assert.deepEqual(voice.spoken, [REPLY]);
});

test("approval voice: other words go on as they are", () => {
  const { voice, onward } = listening();
  voice.say("run the tests");
  assert.deepEqual(onward, ["run the tests"]);
});

test("approval voice: the session in front when you started talking is answered first", () => {
  const front = new FrontSession();
  front.pageInFront("page", "s7");
  const { voice, approvals } = listening(front);
  voice.say(APPROVAL);
  assert.deepEqual(approvals.answeredFor, ["s7"]);
});
