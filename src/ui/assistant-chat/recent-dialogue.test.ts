import { test } from "node:test";
import assert from "node:assert/strict";
import { RecentDialogue } from "./recent-dialogue.js";

test("recent dialogue: the pieces of one reply join into one message", () => {
  const dialogue = new RecentDialogue();
  dialogue.add({ role: "orchestrator", text: "On it." });
  dialogue.add({ role: "orchestrator", text: "Sent." });
  assert.deepEqual(dialogue.recent, [{ role: "orchestrator", text: "On it.\n\nSent." }]);
});

test("recent dialogue: a reply after a finished one is a message of its own", () => {
  const dialogue = new RecentDialogue();
  dialogue.add({ role: "orchestrator", text: "Sent." });
  dialogue.endReply();
  dialogue.add({ role: "orchestrator", text: "Session 10 finished." });
  assert.equal(dialogue.recent.length, 2);
});

test("recent dialogue: your words and the reply stay apart", () => {
  const dialogue = new RecentDialogue();
  dialogue.add({ role: "user", text: "run the tests" });
  dialogue.add({ role: "orchestrator", text: "Running them." });
  assert.deepEqual(
    dialogue.recent.map((line) => line.role),
    ["user", "orchestrator"],
  );
});

test("recent dialogue: only the last 40 lines are kept", () => {
  const dialogue = new RecentDialogue();
  for (let index = 0; index < 45; index++) dialogue.add({ role: "user", text: `line ${index}` });
  assert.equal(dialogue.recent[0].text, "line 5");
});
