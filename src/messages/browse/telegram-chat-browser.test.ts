import assert from "node:assert/strict";
import { test } from "node:test";
import type { TelegramSettings } from "../../config/messages-config.js";
import { PushingTelegram, telegramChat } from "../../testing/pushing-telegram.js";
import { TELEGRAM_SERVICE_ACCOUNT } from "../telegram/telegram-chat-choice.js";
import { UnknownChatError, type TelegramMessage } from "../telegram/telegram-port.js";
import { TelegramChatBrowser } from "./telegram-chat-browser.js";

const SETTINGS: TelegramSettings = { profile: "personal", chats: [], exclude: ["Spam"], notify: [], send: false };
const HELLO: TelegramMessage = {
  id: 9,
  from: "Bob",
  sentAt: new Date("2026-11-16T09:00:00Z"),
  text: "hi",
  hasMedia: false,
};

function everyKind(): PushingTelegram {
  return new PushingTelegram([
    telegramChat("1", "Bob"),
    telegramChat("2", "Family", "group"),
    telegramChat("3", "News", "channel"),
    telegramChat("4", "Spam", "group"),
    telegramChat(TELEGRAM_SERVICE_ACCOUNT, "Telegram"),
  ]);
}

/** A fresh connection that knows a chat only after the chat list has been asked for. */
class ForgetfulTelegram extends PushingTelegram {
  override async readMessages(): Promise<TelegramMessage[]> {
    if (!this.listings) throw new UnknownChatError("1");
    return [HELLO];
  }
}

test("telegram chat browser: every chat is listed, whatever chats: says", async () => {
  const chats = await new TelegramChatBrowser(SETTINGS, async () => everyKind()).listChats();
  assert.deepEqual(
    chats.map((chat) => [chat.name, chat.kind]),
    [
      ["Bob", "dm"],
      ["Family", "group"],
      ["News", "channel"],
    ],
  );
});

test("telegram chat browser: the connection is let go after listing", async () => {
  const telegram = everyKind();
  await new TelegramChatBrowser(SETTINGS, async () => telegram).listChats();
  assert.ok(telegram.closed);
});

test("telegram chat browser: a chat's messages are read with their IDs", async () => {
  const telegram = everyKind();
  telegram.messages = [HELLO];
  const messages = await new TelegramChatBrowser(SETTINGS, async () => telegram).readChat("1");
  assert.deepEqual(messages, [
    { id: "9", from: "Bob", sentAt: "2026-11-16T09:00:00.000Z", text: "hi", hasMedia: false, files: [] },
  ]);
});

test("telegram chat browser: a chat the connection doesn't know yet is read after listing the chats", async () => {
  const messages = await new TelegramChatBrowser(SETTINGS, async () => new ForgetfulTelegram()).readChat("1");
  assert.equal(messages.length, 1);
});

test("telegram chat browser: a message's video is offered as a file, known by its message", async () => {
  const telegram = everyKind();
  telegram.messages = [{ ...HELLO, hasMedia: true, file: { name: "clip.mp4", mimeType: "video/mp4", size: 900 } }];
  const [message] = await new TelegramChatBrowser(SETTINGS, async () => telegram).readChat("1");
  assert.deepEqual(message.files, [{ id: "9", name: "clip.mp4", mimeType: "video/mp4", size: 900 }]);
});

test("telegram chat browser: a file is downloaded from its message", async () => {
  const telegram = everyKind();
  await new TelegramChatBrowser(SETTINGS, async () => telegram).downloadFile("1", "9");
  assert.deepEqual(telegram.downloads, [{ chatId: "1", messageId: 9 }]);
});

test("telegram chat browser: what you write is sent to the chat", async () => {
  const telegram = everyKind();
  await new TelegramChatBrowser(SETTINGS, async () => telegram).send("1", "on my way");
  assert.deepEqual(telegram.sent, [{ chatId: "1", text: "on my way", replyTo: undefined }]);
});
