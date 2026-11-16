import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { MacVoice, type WordsHandoff } from "./mac-voice.js";
import { SharedMic } from "./shared-mic.js";

/** Stands in for a page's message box; `isOpen` says whether one is there to take your words. */
class FakeBox implements WordsHandoff {
  told: string[] = [];

  constructor(private isOpen: boolean) {}

  takes(words: string): boolean {
    if (this.isOpen) this.told.push(`takes ${words}`);
    return this.isOpen;
  }

  passedBy(): void {
    this.told.push("passed by");
  }
}

const SPEAKER = { speak: () => Promise.resolve(), stop: () => {}, repeatLast: () => Promise.resolve() };
const HOTKEY = { start: () => Promise.resolve() };

function macVoice(box: FakeBox): { voice: MacVoice; mic: SharedMic; heard: string[] } {
  const recorder = Object.assign(new EventEmitter(), {
    prepare: () => Promise.resolve(),
    start: () => "Listening…",
    finish: () => Promise.resolve(""),
    cancel: () => Promise.resolve(""),
  });
  const mic = new SharedMic(recorder, { stopSpeaking: () => {}, play: () => {} });
  const voice = new MacVoice(mic, SPEAKER, HOTKEY);
  const heard: string[] = [];
  voice.onUtterance((text) => heard.push(text));
  voice.handOffTo(box);
  return { voice, mic, heard };
}

test("mac voice: a page's box takes your words, so they don't go straight on", () => {
  const box = new FakeBox(true);
  const { mic, heard } = macVoice(box);
  mic.emit("sent", "add a dark mode");
  assert.deepEqual([box.told, heard], [["takes add a dark mode"], []]);
});

test("mac voice: with no box to take them, your words go straight on", () => {
  const box = new FakeBox(false);
  const { mic, heard } = macVoice(box);
  mic.emit("sent", "add a dark mode");
  assert.deepEqual(heard, ["add a dark mode"]);
});

test("mac voice: an approval goes straight on and puts the box back as it was", () => {
  const box = new FakeBox(true);
  const { voice, mic, heard } = macVoice(box);
  voice.endRecordingWhen((words) => words === "allow");
  mic.emit("sent", "allow");
  assert.deepEqual([box.told, heard], [["passed by"], ["allow"]]);
});

test("mac voice: nothing said sends nothing and puts the box back as it was", () => {
  const box = new FakeBox(true);
  const { mic, heard } = macVoice(box);
  mic.emit("sent", "");
  assert.deepEqual([box.told, heard], [["passed by"], []]);
});
