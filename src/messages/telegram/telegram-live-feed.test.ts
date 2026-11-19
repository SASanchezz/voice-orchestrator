import assert from "node:assert/strict";
import { test } from "node:test";
import type { TelegramSettings } from "../../config/messages-config.js";
import { PushingTelegram, telegramChat } from "../../testing/pushing-telegram.js";
import type { InboundMessage, InboundSink } from "../replies/inbound.js";
import { TelegramLiveFeed } from "./telegram-live-feed.js";

const SENDING: TelegramSettings = { profile: "personal", chats: "all", exclude: ["Ann"], notify: [], send: true };

class Inbox implements InboundSink {
  readonly messages: InboundMessage[] = [];

  received(message: InboundMessage): void {
    this.messages.push(message);
  }
}

function chats(): PushingTelegram {
  return new PushingTelegram([
    telegramChat("1", "Bob"),
    telegramChat("2", "Ann"),
    telegramChat("3", "Team", "group"),
    telegramChat("4", "News", "channel"),
    telegramChat("5", "Helper", "bot"),
    telegramChat("777000", "Telegram"),
  ]);
}

async function listening(telegram: PushingTelegram): Promise<Inbox> {
  const inbox = new Inbox();
  await new TelegramLiveFeed(SENDING, async () => telegram, inbox).start();
  return inbox;
}

const flush = async (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

async function chatKindsAfterPushing(chatId: string): Promise<string[]> {
  const telegram = chats();
  const inbox = await listening(telegram);
  telegram.push({ chatId, from: "Someone", messageId: 9 });
  await flush();
  return inbox.messages.map((message) => message.chatKind);
}

test("telegram live feed: a private chat's message reaches the inbox", async () => {
  const telegram = chats();
  const inbox = await listening(telegram);
  telegram.push({ chatId: "1", from: "Bob", messageId: 9 });
  await flush();
  assert.deepEqual(inbox.messages, [
    { sourceKey: "telegram", source: "Telegram", chatId: "1", chatKind: "dm", from: "Bob", messageId: "9" },
  ]);
});

test("telegram live feed: a group's message comes as a group's", async () => {
  assert.deepEqual(await chatKindsAfterPushing("3"), ["group"]);
});

test("telegram live feed: a channel is never answered", async () => {
  assert.deepEqual(await chatKindsAfterPushing("4"), []);
});

test("telegram live feed: a bot is never answered", async () => {
  assert.deepEqual(await chatKindsAfterPushing("5"), []);
});

test("telegram live feed: an excluded chat is left out", async () => {
  assert.deepEqual(await chatKindsAfterPushing("2"), []);
});

test("telegram live feed: Telegram's service account is left out", async () => {
  assert.deepEqual(await chatKindsAfterPushing("777000"), []);
});

test("telegram live feed: a new chat is found by listing again", async () => {
  const telegram = chats();
  const inbox = await listening(telegram);
  telegram.chats = [...telegram.chats, telegramChat("6", "Carol")];
  telegram.push({ chatId: "6", from: "Carol", messageId: 1 });
  await flush();
  assert.equal(inbox.messages[0]?.from, "Carol");
});

test("telegram live feed: a known chat that isn't answered doesn't list again", async () => {
  const telegram = chats();
  await listening(telegram);
  telegram.push({ chatId: "2", from: "Ann", messageId: 1 });
  await flush();
  assert.equal(telegram.listings, 1);
});
