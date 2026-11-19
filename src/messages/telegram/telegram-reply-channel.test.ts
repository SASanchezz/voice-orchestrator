import assert from "node:assert/strict";
import { test } from "node:test";
import { PushingTelegram } from "../../testing/pushing-telegram.js";
import { newDraft, type Draft } from "../replies/draft-store.js";
import type { InboundMessage } from "../replies/inbound.js";
import { UnknownChatError } from "./telegram-port.js";
import { TelegramReplyChannel } from "./telegram-reply-channel.js";

const FROM_BOB: InboundMessage = {
  sourceKey: "telegram",
  source: "Telegram",
  chatId: "1",
  chatKind: "dm",
  from: "Bob",
  messageId: "9",
};
const QUESTION = { needsReply: true, kind: "question", urgency: "normal" } as const;

function draftFor(message: InboundMessage): Draft {
  return newDraft([message], "Bob", { triage: QUESTION, text: "draft" });
}

/** Knows no chats until they are listed, like a connection opened afresh. */
class FreshTelegram extends PushingTelegram {
  attempts = 0;

  async sendMessage(chatId: string, text: string, replyTo?: number): Promise<void> {
    this.attempts++;
    if (!this.listings) throw new UnknownChatError(chatId);
    await super.sendMessage(chatId, text, replyTo);
  }
}

test("telegram reply channel: a DM reply is sent without quoting", async () => {
  const telegram = new PushingTelegram();
  await new TelegramReplyChannel(async () => telegram).send(draftFor(FROM_BOB), "Friday.");
  assert.deepEqual(telegram.sent, [{ chatId: "1", text: "Friday.", replyTo: undefined }]);
});

test("telegram reply channel: a group reply quotes the message it answers", async () => {
  const telegram = new PushingTelegram();
  await new TelegramReplyChannel(async () => telegram).send(draftFor({ ...FROM_BOB, chatKind: "group" }), "Friday.");
  assert.equal(telegram.sent[0]?.replyTo, 9);
});

test("telegram reply channel: the draft is put in Telegram's own message box", async () => {
  const telegram = new PushingTelegram();
  await new TelegramReplyChannel(async () => telegram).prefill(draftFor(FROM_BOB), "Friday.");
  assert.deepEqual(telegram.drafts, [{ chatId: "1", text: "Friday.", replyTo: undefined }]);
});

test("telegram reply channel: clearing empties Telegram's message box", async () => {
  const telegram = new PushingTelegram();
  await new TelegramReplyChannel(async () => telegram).clearPrefill(draftFor(FROM_BOB));
  assert.equal(telegram.drafts[0]?.text, "");
});

test("telegram reply channel: lets go of the shared connection", async () => {
  const telegram = new PushingTelegram();
  await new TelegramReplyChannel(async () => telegram).send(draftFor(FROM_BOB), "Friday.");
  assert.equal(telegram.closed, true);
});

test("telegram reply channel: a chat the connection doesn't know yet is listed and sent once", async () => {
  const telegram = new FreshTelegram();
  await new TelegramReplyChannel(async () => telegram).send(draftFor(FROM_BOB), "Friday.");
  assert.deepEqual([telegram.attempts, telegram.sent.length], [2, 1]);
});

test("telegram reply channel: any other failure isn't retried, so nothing is sent twice", async () => {
  const telegram = new PushingTelegram();
  let attempts = 0;
  telegram.sendMessage = async () => {
    attempts++;
    throw new Error("network dropped");
  };
  await assert.rejects(new TelegramReplyChannel(async () => telegram).send(draftFor(FROM_BOB), "Friday."));
  assert.equal(attempts, 1);
});
