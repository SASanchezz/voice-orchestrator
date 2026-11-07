import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfirmAsk } from "../orchestrator/conversation/confirm-ask.js";
import { ConversationLines } from "../orchestrator/conversation/conversation-lines.js";
import { TestQuestionPanels } from "../testing/test-question-panels.js";
import { ConfirmPopups } from "./confirm-popups.js";

const REPLY = 'Pushing is destructive, say "confirm push".';

/** Confirm pop-ups following the assistant's requests; records the words its clicks typed. */
function popups() {
  const lines = new ConversationLines();
  const ask = new ConfirmAsk();
  ask.follow(lines);
  const panels = new TestQuestionPanels();
  const typed: string[] = [];
  new ConfirmPopups(panels, { receiveTyped: (text) => void typed.push(text) }).follow(ask, lines);
  return { lines, ask, panels, typed };
}

test("confirm popups: a request shows the assistant's reply with a Confirm per verb and Cancel", () => {
  const { lines, ask, panels } = popups();
  lines.say({ role: "orchestrator", text: REPLY });
  ask.ask(["push", "delete"]);
  assert.deepEqual(panels.latest().panel, {
    title: "Assistant waits for your confirmation",
    detail: REPLY,
    buttons: [
      { answer: "confirm:push", label: "Confirm push" },
      { answer: "confirm:delete", label: "Confirm delete" },
      { answer: "cancel", label: "Cancel" },
    ],
    acceptsText: false,
  });
});

test("confirm popups: the reply shown is only what came after your last words", () => {
  const { lines, ask, panels } = popups();
  lines.say({ role: "orchestrator", text: "Earlier answer." });
  lines.say({ role: "user", text: "push it" });
  lines.say({ role: "orchestrator", text: REPLY });
  ask.ask(["push"]);
  assert.equal(panels.latest().panel.detail, REPLY);
});

test("confirm popups: Confirm types the confirm phrase", () => {
  const { ask, panels, typed } = popups();
  ask.ask(["push"]);
  panels.latest().choose("confirm:push");
  assert.deepEqual(typed, ["confirm push"]);
});

test("confirm popups: Cancel types the cancel words", () => {
  const { ask, panels, typed } = popups();
  ask.ask(["push", "delete"]);
  panels.latest().choose("cancel");
  assert.deepEqual(typed, ["Cancel, don't push or delete."]);
});

test("confirm popups: a verb that wasn't asked types nothing", () => {
  const { ask, panels, typed } = popups();
  ask.ask(["push"]);
  panels.latest().choose("confirm:delete");
  assert.deepEqual(typed, []);
});

test("confirm popups: your words close the pop-up", () => {
  const { lines, ask, panels } = popups();
  ask.ask(["push"]);
  lines.say({ role: "user", text: "not yet" });
  assert.equal(panels.latest().closed, true);
});

test("confirm popups: a new request replaces the open pop-up", () => {
  const { ask, panels } = popups();
  ask.ask(["push"]);
  ask.ask(["delete"]);
  assert.equal(panels.shown[0].closed, true);
});
