import { test } from "node:test";
import assert from "node:assert/strict";
import type { Input } from "./inputs.js";
import { SpokenMessages } from "./spoken-messages.js";

function spokenMessages(note: string): { spoken: SpokenMessages; queued: Input[] } {
  const queued: Input[] = [];
  const loop = { enqueue: (input: Input) => void queued.push(input) };
  return { spoken: new SpokenMessages(loop, { annotate: (text) => text + note }), queued };
}

test("spoken messages: the words reach the assistant as speech", () => {
  const { spoken, queued } = spokenMessages("");
  spoken.receive("what changed?");
  assert.deepEqual(queued, [{ kind: "user", text: "what changed?", source: "voice" }]);
});

test("spoken messages: pointing while talking is noted with the words", () => {
  const { spoken, queued } = spokenMessages(" [pointing]");
  spoken.receive("what is this?");
  assert.deepEqual(
    queued.map((input) => input.kind === "user" && input.text),
    ["what is this? [pointing]"],
  );
});
