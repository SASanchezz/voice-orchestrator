import { test } from "node:test";
import assert from "node:assert/strict";
import { decisionOf, preToolUse } from "../support/fake-worker.js";
import { operatorSessions } from "../support/fake-operator.js";
import { app, voice } from "../support/harness.js";
import { mark, nextOperatorSession, pause, uiPost } from "../support/helpers.js";

const { operator } = app;

test("finished tasks are kept in project history", async () => {
  const i = mark();
  voice.say("history dbadmin");
  assert.match(await voice.heard(/\[done\]/, i), /echo hello > dummy\.txt/);
});

test("user-requested fresh reset drops the conversation but keeps project history", async () => {
  const before = operatorSessions.length;
  const i = mark();
  voice.say("reset context nothing");
  await voice.heard(/starting fresh/, i);
  await nextOperatorSession(operatorSessions, before);
  const s = operatorSessions.at(-1)!;
  assert.equal(operatorSessions.length, before + 1);
  assert.doesNotMatch(s.systemPrompt, /Handoff|Last exchanges/);
  assert.match(s.systemPrompt, /Recent tasks per project[\s\S]*dbadmin:/);
});

test("asking for a restart speaks the confirmation first, then asks the app to restart", async () => {
  const i = mark();
  const restarted = new Promise<number>((r) => operator.lifecycle.once("restart", () => r(voice.spoken.length)));
  voice.say("restart yourself");
  const spokenWhenRestarted = await restarted;
  assert.match(voice.spoken.slice(i, spokenWhenRestarted).join(" "), /will restart/);
});

test("ui: the Restart button asks the app to restart, after answering the page", async () => {
  const restarted = new Promise<void>((r) => operator.lifecycle.once("restart", () => r()));
  const reply = await uiPost("/api/restart", {});
  await restarted;
  assert.equal(reply.status, 200);
});

/** What the operator's own PreToolUse hooks decide for a calendar call made while the user said `utterance`. */
async function operatorDecision(tool: string, utterance: string): Promise<string | undefined> {
  const input = preToolUse(`mcp__claude_ai_Google_Calendar__${tool}`, { eventId: "e1" });
  const hooks = operatorSessions.at(-1)!.preToolUse;
  const outputs = await operator.context.withUtterance(utterance, () =>
    Promise.all(hooks.map((hook) => hook(input, "t", { signal: new AbortController().signal }))),
  );
  return outputs.map(decisionOf).find(Boolean);
}

test("calendar: deleting an event without 'confirm delete' is refused", async () => {
  assert.equal(await operatorDecision("delete_event", "yes, delete it"), "deny");
});

test("calendar: deleting an event after 'confirm delete' goes ahead", async () => {
  assert.equal(await operatorDecision("delete_event", "confirm delete"), undefined);
});

test("calendar: changing an event without 'confirm update' is refused", async () => {
  assert.equal(await operatorDecision("update_event", "yes, add the reminder"), "deny");
});

test("calendar: changing an event after 'confirm update' goes ahead", async () => {
  assert.equal(await operatorDecision("update_event", "confirm update"), undefined);
});

test("calendar: creating an event needs no confirm phrase", async () => {
  assert.equal(await operatorDecision("create_event", "add dentist on friday at 3"), undefined);
});

test("a crashed session restarts after a wait; what you say meanwhile is answered by the new one", async () => {
  const before = operatorSessions.length;
  const i = mark();
  voice.say("crash");
  await voice.heard(/session crashed/, i);
  voice.say("history dbadmin");
  await pause(300);
  assert.equal(operatorSessions.length, before);
  assert.match(await voice.heard(/\[done\]/, i), /echo hello > dummy\.txt/);
  assert.equal(operatorSessions.length, before + 1);
});
