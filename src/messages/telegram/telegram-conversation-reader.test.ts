import assert from "node:assert/strict";
import { test } from "node:test";
import type { TelegramSettings } from "../../config/messages-config.js";
import { PushingTelegram } from "../../testing/pushing-telegram.js";
import type { InboundMessage } from "../replies/inbound.js";
import { TelegramConversationReader } from "./telegram-conversation-reader.js";

const SENDING: TelegramSettings = { profile: "personal", chats: "all", exclude: [], notify: [], send: true };
const FROM_BOB: InboundMessage = {
  sourceKey: "telegram",
  source: "Telegram",
  chatId: "1",
  chatKind: "dm",
  from: "Bob",
  messageId: "9",
};

function bobsChat(): PushingTelegram {
  const telegram = new PushingTelegram();
  telegram.messages = [{ id: 9, from: "Bob", sentAt: new Date("2026-11-16T09:00:00Z"), text: "hi", hasMedia: false }];
  return telegram;
}

test("telegram conversation reader: reads the chat's latest messages", async () => {
  const reading = await new TelegramConversationReader(SENDING, async () => bobsChat()).read(FROM_BOB);
  assert.deepEqual(
    reading.messages.map((message) => message.text),
    ["hi"],
  );
});

test("telegram conversation reader: the chat is named from the chat list", async () => {
  const reading = await new TelegramConversationReader(SENDING, async () => bobsChat()).read(FROM_BOB);
  assert.equal(reading.chatName, "Bob");
});

test("telegram conversation reader: it runs on Telegram's account", async () => {
  const reading = await new TelegramConversationReader(SENDING, async () => bobsChat()).read(FROM_BOB);
  assert.equal(reading.profile, "personal");
});

test("telegram conversation reader: lets go of the shared connection afterwards", async () => {
  const telegram = bobsChat();
  await new TelegramConversationReader(SENDING, async () => telegram).read(FROM_BOB);
  assert.equal(telegram.closed, true);
});
