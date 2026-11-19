import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry, type RegistryParts } from "../registry/open-registry.js";
import type { ClosedConversation } from "./closed-conversations.js";
import { SessionReopener } from "./session-reopener.js";
import { WorkerChat, type SessionMessage } from "./worker-chat.js";

const ASKED_AT = "2026-11-19T07:00:00.000Z";

interface Setup {
  parts: RegistryParts;
  conversation: ClosedConversation;
}

function setUp(): Setup {
  const dir = mkdtempSync(join(tmpdir(), "vo-reopen-"));
  setStateDir(dir);
  const transcriptFile = join(dir, "claude-1.jsonl");
  const prompt = { type: "user", timestamp: ASKED_AT, message: { role: "user", content: "add pauses" } };
  writeFileSync(transcriptFile, `${JSON.stringify(prompt)}\n`);
  const conversation = { claudeSessionId: "claude-1", title: "Adding pauses", lastActive: new Date(), transcriptFile };
  return { parts: openRegistry({ webshop: "personal" }, new AppEvents()), conversation };
}

function reopenerOf(parts: RegistryParts, chat = new WorkerChat()): SessionReopener {
  return new SessionReopener(parts.registry, parts.sessions, chat);
}

async function chatAfterReopening({ parts, conversation }: Setup): Promise<SessionMessage[]> {
  const chat = new WorkerChat();
  const said: SessionMessage[] = [];
  chat.on("message", (message: SessionMessage) => said.push(message));
  await reopenerOf(parts, chat).reopen("webshop", conversation);
  return said;
}

test("the reopened session's next task continues the closed conversation", async () => {
  const { parts, conversation } = setUp();
  const session = await reopenerOf(parts).reopen("webshop", conversation);
  assert.equal(parts.sessions.session(session.id).claudeSessionId, "claude-1");
});

test("the reopened session becomes the project's active one", async () => {
  const { parts, conversation } = setUp();
  const session = await reopenerOf(parts).reopen("webshop", conversation);
  assert.equal(parts.registry.activeSession("webshop").id, session.id);
});

test("the reopened session keeps the closed one's title", async () => {
  const { parts, conversation } = setUp();
  const session = await reopenerOf(parts).reopen("webshop", conversation);
  assert.equal(parts.sessions.session(session.id).title, "Adding pauses");
});

test("the reopened session's chat brings back the closed one's tasks at their own times", async () => {
  const [restored] = await chatAfterReopening(setUp());
  assert.deepEqual([restored.kind, restored.text, restored.at], ["task", "add pauses", ASKED_AT]);
});

test("the reopened session's chat ends saying what it continues", async () => {
  const said = await chatAfterReopening(setUp());
  assert.match(said.at(-1)?.text ?? "", /Reopened the closed session "Adding pauses"/);
});
