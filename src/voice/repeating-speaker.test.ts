import { test } from "node:test";
import assert from "node:assert/strict";
import { RepeatingSpeaker, type Speaker } from "./repeating-speaker.js";

/** A speaker that writes down what it says instead of saying it. */
function speaker(): { speaker: RepeatingSpeaker; said: string[] } {
  const said: string[] = [];
  const fake: Speaker = {
    speak: (text) => {
      said.push(text);
      return Promise.resolve();
    },
    stop: () => {},
  };
  return { speaker: new RepeatingSpeaker(fake), said };
}

test("repeating speaker: repeats the last thing it said", async () => {
  const { speaker: voice, said } = speaker();
  await voice.speak("first");
  await voice.speak("second");
  await voice.repeatLast();
  assert.deepEqual(said, ["first", "second", "second"]);
});

test("repeating speaker: says nothing before anything was said", async () => {
  const { speaker: voice, said } = speaker();
  await voice.repeatLast();
  assert.deepEqual(said, []);
});

test("repeating speaker: blank text doesn't replace what is repeated", async () => {
  const { speaker: voice, said } = speaker();
  await voice.speak("hello");
  await voice.speak("  ");
  await voice.repeatLast();
  assert.deepEqual(said, ["hello", "  ", "hello"]);
});
