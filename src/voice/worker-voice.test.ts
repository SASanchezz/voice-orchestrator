import { test } from "node:test";
import assert from "node:assert/strict";
import { FrontSession } from "../ui/front-session.js";
import { TextVoice } from "./text-voice.js";
import { WorkerVoice } from "./worker-voice.js";

/** A voice whose talk key and finished words the test drives. */
class DrivenVoice extends TextVoice {
  private pressCallback: () => void = () => {};
  private utteranceCallback: (text: string) => void = () => {};

  override onPress(cb: () => void): void {
    this.pressCallback = cb;
  }

  override onUtterance(cb: (text: string) => void): void {
    this.utteranceCallback = cb;
  }

  say(text: string): void {
    this.pressCallback();
    this.utteranceCallback(text);
  }

  pressThenSay(text: string, betweenPressAndWords: () => void): void {
    this.pressCallback();
    betweenPressAndWords();
    this.utteranceCallback(text);
  }
}

interface Heard {
  assistant: string[];
  workers: [string, string][];
}

function listeningVoice(front: FrontSession, voice: DrivenVoice): Heard {
  const heard: Heard = { assistant: [], workers: [] };
  const workerVoice = new WorkerVoice(voice, front, (session, text) => heard.workers.push([session, text]));
  workerVoice.onPress(() => {});
  workerVoice.onUtterance((text) => heard.assistant.push(text));
  return heard;
}

function frontShowing(session: string): FrontSession {
  const front = new FrontSession();
  front.pageInFront("p1", session);
  return front;
}

test("worker voice: with no project tab in front, your words go to the assistant", () => {
  const voice = new DrivenVoice();
  const heard = listeningVoice(new FrontSession(), voice);
  voice.say("hello");
  assert.deepEqual(heard.assistant, ["hello"]);
});

test("worker voice: with a project tab in front, your words go to its worker", () => {
  const voice = new DrivenVoice();
  const heard = listeningVoice(frontShowing("s1"), voice);
  voice.say("fix the test");
  assert.deepEqual(heard.workers, [["s1", "fix the test"]]);
});

test("worker voice: with a project tab in front, the assistant doesn't get your words", () => {
  const voice = new DrivenVoice();
  const heard = listeningVoice(frontShowing("s1"), voice);
  voice.say("fix the test");
  assert.deepEqual(heard.assistant, []);
});

test("worker voice: switching to another app after you started talking still sends to the worker", () => {
  const voice = new DrivenVoice();
  const front = frontShowing("s1");
  const heard = listeningVoice(front, voice);
  voice.pressThenSay("fix the test", () => front.pageLeftFront("p1"));
  assert.deepEqual(heard.workers, [["s1", "fix the test"]]);
});

test("worker voice: a worker that can't take your words doesn't pass them to the assistant", () => {
  const voice = new DrivenVoice();
  const assistant: string[] = [];
  const failing = new WorkerVoice(voice, frontShowing("s1"), () => {
    throw new Error("closed");
  });
  failing.onPress(() => {});
  failing.onUtterance((text) => assistant.push(text));
  voice.say("fix the test");
  assert.deepEqual(assistant, []);
});
