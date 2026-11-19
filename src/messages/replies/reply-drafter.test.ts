import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { QueryCall } from "../../testing/fake-query.js";
import { promptOf, scriptedModel } from "../../testing/scripted-model.js";
import type { ChatRule } from "./chat-rules.js";
import { ConversationReaders, type ConversationReader, type ConversationReading } from "./conversation-reading.js";
import { DraftStore, type Draft } from "./draft-store.js";
import type { InboundMessage } from "./inbound.js";
import { ReplyDrafter } from "./reply-drafter.js";

const RULE: ChatRule = { mode: "draft", alert: "popup", priority: "normal", research: "allowed", note: "be brief" };
const FROM_BOB: InboundMessage = {
  sourceKey: "slack:acme",
  source: "Slack acme",
  chatId: "D1",
  chatKind: "dm",
  from: "Bob",
  messageId: "1.1",
};
const NEEDS_REPLY = '{"needsReply": true, "kind": "question", "urgency": "high"}';
const NO_REPLY = '{"needsReply": false, "kind": "fyi", "urgency": "low"}';

class BobsDm implements ConversationReader {
  read(): Promise<ConversationReading> {
    const message = {
      from: "Bob",
      sentAt: new Date("2026-11-16T09:00:00Z"),
      text: "When is the release?",
      hasMedia: false,
    };
    return Promise.resolve({ chatName: "Bob", profile: "work", messages: [message] });
  }
}

class Unreachable implements ConversationReader {
  read(): Promise<ConversationReading> {
    return Promise.reject(new Error("Slack is down"));
  }
}

function answers(triage: string, reply: string): (call: QueryCall) => string {
  return (call) => (call.options?.model === "haiku" ? triage : reply);
}

async function drafted(answer: (call: QueryCall) => string, reader: ConversationReader = new BobsDm()) {
  const store = new DraftStore(join(mkdtempSync(join(tmpdir(), "drafter-")), "drafts.json"));
  const { model, calls } = scriptedModel(answer);
  const filing = { file: async (draft: Draft): Promise<void> => store.add(draft), failed: (): void => {} };
  const drafter = new ReplyDrafter(new ConversationReaders(new Map([["slack:acme", reader]])), model, filing);
  drafter.requested({ messages: [FROM_BOB], rule: RULE });
  await drafter.settled();
  return { drafts: store.all(), calls };
}

test("reply drafter: a message needing a reply gets a ready draft", async () => {
  const { drafts } = await drafted(answers(NEEDS_REPLY, "Friday!"));
  assert.deepEqual(
    drafts.map((draft) => [draft.status, draft.text, draft.urgency]),
    [["ready", "Friday!", "high"]],
  );
});

test("reply drafter: the draft is filed under the chat's name", async () => {
  const { drafts } = await drafted(answers(NEEDS_REPLY, "Friday!"));
  assert.equal(drafts[0].chatName, "Bob");
});

test("reply drafter: a message needing no reply gets no text and no writer", async () => {
  const { drafts, calls } = await drafted(answers(NO_REPLY, "unused"));
  assert.deepEqual([drafts[0].status, drafts[0].text, calls.length], ["no-reply", undefined, 1]);
});

test("reply drafter: a secret in the written draft is hidden", async () => {
  const { drafts } = await drafted(answers(NEEDS_REPLY, "use password: hunter2"));
  assert.equal(drafts[0].text, "use password: [hidden]");
});

test("reply drafter: the chat's note reaches the writer", async () => {
  const { calls } = await drafted(answers(NEEDS_REPLY, "ok"));
  assert.ok(promptOf(calls[1]).includes("be brief"));
});

test("reply drafter: both calls run on the source's account", async () => {
  const { calls } = await drafted(answers(NEEDS_REPLY, "ok"));
  assert.deepEqual(
    calls.map((call) => call.options?.env?.CLAUDE_CONFIG_DIR),
    ["/w", "/w"],
  );
});

test("reply drafter: a conversation that can't be read files nothing", async () => {
  const { drafts } = await drafted(answers(NEEDS_REPLY, "ok"), new Unreachable());
  assert.equal(drafts.length, 0);
});
