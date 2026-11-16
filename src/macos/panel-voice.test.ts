import { test } from "node:test";
import assert from "node:assert/strict";
import { passOnVoiced, voiceCommandLine } from "./panel-voice.js";

/** Passes `line` on, and says what each side heard. */
function passed(line: string): string[] {
  const heard: string[] = [];
  const voice = { cameToFront: () => void heard.push("front"), editing: () => void heard.push("editing") };
  passOnVoiced(line, voice, (rest) => void heard.push(`onward ${rest}`));
  return heard;
}

test("panel voice: coming to the front is told to the voice box", () => {
  assert.deepEqual(passed("front\n"), ["front"]);
});

test("panel voice: a click into the field is told to the voice box", () => {
  assert.deepEqual(passed("edit"), ["editing"]);
});

test("panel voice: anything else goes on", () => {
  assert.deepEqual(passed("text:Postgres"), ["onward text:Postgres"]);
});

test("panel voice: what happens to the recording becomes one line for the pop-up", () => {
  assert.equal(voiceCommandLine({ kind: "words", words: "add" }), '{"command":"voice","kind":"words","words":"add"}\n');
});
