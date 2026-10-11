import { test } from "node:test";
import assert from "node:assert/strict";
import { ConversationMemory } from "../../orchestrator/memory/conversation-memory.js";
import { operatorSessions } from "../support/fake-operator.js";
import { app, voice } from "../support/harness.js";
import { feedHas, mark, nextOperatorSession, uiPost } from "../support/helpers.js";

const { ui } = app;
const HANDOFF = /Handoff: user wants to be told when acme-web finishes/;

test("ui: clearing the assistant empties its chat", async () => {
  await uiPost("/api/message", { text: "status" });
  await feedHas(/dbadmin \[personal\]/);
  assert.equal((await uiPost("/api/assistant/clear", {})).status, 200);
  assert.equal(ui.feed.recent().length, 0);
});

test("ui: clearing the assistant saves its summary before the chat empties", async () => {
  await uiPost("/api/message", { text: "status" });
  await feedHas(/dbadmin \[personal\]/);
  let recapWhenCleared = "";
  ui.feed.once("cleared", () => (recapWhenCleared = new ConversationMemory().recap()));
  await uiPost("/api/assistant/clear", {});
  assert.match(recapWhenCleared, HANDOFF);
});

test("ui: clearing the assistant carries a summary into its new context", async () => {
  const before = operatorSessions.length;
  await uiPost("/api/assistant/clear", {});
  await nextOperatorSession(operatorSessions, before);
  assert.match(operatorSessions.at(-1)!.systemPrompt, HANDOFF);
});

test("ui: clearing the assistant drops the earlier exchanges from its new context", () => {
  assert.doesNotMatch(operatorSessions.at(-1)!.systemPrompt, /Last exchanges/);
});

test("ui: clearing the assistant saves the summary for after a restart", () => {
  assert.match(new ConversationMemory().recap(), HANDOFF);
});

test("ui: clearing the assistant keeps project history", async () => {
  const i = mark();
  voice.say("history dbadmin");
  assert.match(await voice.heard(/\[done\]/, i), /echo hello > dummy\.txt/);
});
