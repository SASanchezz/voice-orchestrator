import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ChatFiles } from "../../ui/chat-files.js";
import { SessionChats } from "../../ui/session-chats.js";
import { app, uiToken, uiUrl } from "../support/harness.js";
import { chatHas, chatText, uiPost } from "../support/helpers.js";
import { root } from "../support/sandbox.js";

const { core, ui, workers } = app;
const chatFile = (sessionId: string): string => join(root, "state", "chats", `${sessionId}.json`);

test("chats: each project keeps its own message history", async () => {
  const dbadminSession = core.registry.activeSession("dbadmin").id;
  workers.intake.run("dbadmin", "sleep: 5");
  await chatHas(dbadminSession, /^Finished\.$/);
  assert.doesNotMatch(chatText(core.registry.activeSession("acme-web").id), /sleep: 5/);
});

test("chats: sessions of one project keep separate histories", async () => {
  const first = core.registry.activeSession("dbadmin").id;
  const second = core.registry.createSession("dbadmin").id;
  workers.intake.run("dbadmin", "sleep: 6");
  await chatHas(second, /^Finished\.$/);
  assert.deepEqual([/sleep: 6/.test(chatText(first)), ui.chats.messagesOf(second)[0].text], [false, "sleep: 6"]);
});

test("ui: a session's messages are served to the page", async () => {
  const session = core.registry.activeSession("dbadmin").id;
  const res = await fetch(new URL(`/api/sessions/${session}/messages?token=${uiToken}`, uiUrl));
  assert.equal(z.array(z.object({ text: z.string() })).parse(await res.json())[0].text, "sleep: 6");
});

test("chats: a session's messages survive a restart", () => {
  const session = core.registry.activeSession("dbadmin").id;
  const restarted = new SessionChats(new ChatFiles(join(root, "state", "chats")));
  assert.equal(restarted.messagesOf(session)[0].text, "sleep: 6");
});

/** A session with one finished task, then cleared by click. */
async function clearedSession(): Promise<string> {
  const session = core.registry.createSession("acme-web").id;
  workers.intake.runInSession(session, "sleep: 7");
  await chatHas(session, /^Finished\.$/);
  await uiPost(`/api/sessions/${session}/clear`, {});
  return session;
}

test("ui: clearing a session deletes its message history", async () => {
  const session = await clearedSession();
  assert.equal(existsSync(chatFile(session)), false);
});

test("ui: clearing a session keeps it open", async () => {
  assert.equal(core.sessions.hasSession(await clearedSession()), true);
});

test("chats: closing a session deletes its message history", async () => {
  const session = core.registry.activeSession("dbadmin").id;
  await workers.control.closeSession(session);
  assert.equal(existsSync(chatFile(session)), false);
});
