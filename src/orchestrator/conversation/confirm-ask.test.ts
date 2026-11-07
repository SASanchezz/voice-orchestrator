import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfirmAsk } from "./confirm-ask.js";
import { ConversationLines } from "./conversation-lines.js";

function followingAsk(): { ask: ConfirmAsk; lines: ConversationLines } {
  const lines = new ConversationLines();
  const ask = new ConfirmAsk();
  ask.follow(lines);
  return { ask, lines };
}

test("nothing is asked at first", () => {
  assert.deepEqual(new ConfirmAsk().verbs, []);
});

test("asked verbs are lowercase and each once", () => {
  const ask = new ConfirmAsk();
  ask.ask(["Update", "delete", "update"]);
  assert.deepEqual(ask.verbs, ["update", "delete"]);
});

test("a new request replaces the old one", () => {
  const ask = new ConfirmAsk();
  ask.ask(["push"]);
  ask.ask(["remove"]);
  assert.deepEqual(ask.verbs, ["remove"]);
});

test("your next words close the request", () => {
  const { ask, lines } = followingAsk();
  ask.ask(["push"]);
  lines.say({ role: "user", text: "wait, not yet" });
  assert.deepEqual(ask.verbs, []);
});

test("a request is announced with its verbs", () => {
  const ask = new ConfirmAsk();
  const announced: string[][] = [];
  ask.on("asked", (verbs: string[]) => announced.push(verbs));
  ask.ask(["Push"]);
  assert.deepEqual(announced, [["push"]]);
});

test("your words announce that an open request closed", () => {
  const { ask, lines } = followingAsk();
  let closings = 0;
  ask.on("closed", () => closings++);
  ask.ask(["push"]);
  lines.say({ role: "user", text: "ok" });
  assert.equal(closings, 1);
});

test("your words announce nothing when nothing was asked", () => {
  const { ask, lines } = followingAsk();
  let closings = 0;
  ask.on("closed", () => closings++);
  lines.say({ role: "user", text: "hello" });
  assert.equal(closings, 0);
});

test("the assistant's own lines keep it open", () => {
  const { ask, lines } = followingAsk();
  ask.ask(["push"]);
  lines.say({ role: "orchestrator", text: 'Say "confirm push".' });
  assert.deepEqual(ask.verbs, ["push"]);
});
