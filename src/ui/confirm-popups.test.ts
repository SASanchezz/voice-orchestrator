import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfirmAsk } from "../orchestrator/conversation/confirm-ask.js";
import { ConversationLines } from "../orchestrator/conversation/conversation-lines.js";
import { TestConfirmPanels } from "../testing/test-panels.js";
import { ConfirmPopups } from "./confirm-popups.js";

const REPLY = 'Pushing is destructive, say "confirm push".';

/**
 * Confirm pop-ups following the assistant's requests; records the words its clicks typed.
 * `permissionVerbs` are the verbs open permission pop-ups already ask for.
 */
function popups(permissionVerbs: string[] = []) {
  const lines = new ConversationLines();
  const ask = new ConfirmAsk();
  ask.follow(lines);
  const panels = new TestConfirmPanels();
  const typed: string[] = [];
  const typedWords = { receiveTyped: (text: string) => void typed.push(text) };
  const permissionPopups = { isAsking: (verb: string) => permissionVerbs.includes(verb) };
  new ConfirmPopups(panels, typedWords, permissionPopups).follow(ask, lines);
  return { lines, ask, panels, typed };
}

test("confirm popups: a request shows a warning, the reply, then Cancel and a Confirm per verb", () => {
  const { lines, ask, panels } = popups();
  lines.say({ role: "orchestrator", text: REPLY });
  ask.ask(["push", "delete"]);
  assert.deepEqual(panels.latest().panel, {
    title: "Assistant waits for your confirmation",
    warning: 'Destructive (push, delete). Confirm counts as saying "confirm push" or "confirm delete".',
    summary: REPLY,
    buttons: [
      { answer: "cancel", label: "Cancel" },
      { answer: "confirm:push", label: "Confirm push" },
      { answer: "confirm:delete", label: "Confirm delete" },
    ],
  });
});

test("confirm popups: no pop-up opens when a permission pop-up already asks for every verb", () => {
  const { ask, panels } = popups(["commit"]);
  ask.ask(["commit"]);
  assert.equal(panels.shown.length, 0);
});

test("confirm popups: a pop-up opens when a permission pop-up asks for only some of the verbs", () => {
  const { ask, panels } = popups(["commit"]);
  ask.ask(["commit", "push"]);
  assert.equal(panels.shown.length, 1);
});

test("confirm popups: the reply shown is only what came after your last words", () => {
  const { lines, ask, panels } = popups();
  lines.say({ role: "orchestrator", text: "Earlier answer." });
  lines.say({ role: "user", text: "push it" });
  lines.say({ role: "orchestrator", text: REPLY });
  ask.ask(["push"]);
  assert.equal(panels.latest().panel.summary, REPLY);
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
