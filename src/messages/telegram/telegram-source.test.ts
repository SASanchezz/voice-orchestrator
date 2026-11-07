import assert from "node:assert/strict";
import { test } from "node:test";
import type { TelegramSettings } from "../../config/messages-config.js";
import { EMPTY_CURSOR, type SourceCursor } from "../cursors.js";
import { MAX_CHAT_MESSAGES, MAX_TOTAL_MESSAGES } from "./telegram-caps.js";
import { TELEGRAM_SERVICE_ACCOUNT } from "./telegram-chat-choice.js";
import {
  LOGIN_AGAIN,
  TelegramWaitError,
  type TelegramChat,
  type TelegramChats,
  type TelegramMessage,
} from "./telegram-port.js";
import { TelegramSource } from "./telegram-source.js";

const ALL: TelegramSettings = { profile: "personal", chats: "all", exclude: [] };

type ChatBasics = Pick<TelegramChat, "id" | "name" | "kind" | "unreadCount">;

/** A chat whose unread messages are its newest ones, after message 100. */
function chat(basics: ChatBasics): TelegramChat {
  return { ...basics, lastMessageId: 100 + basics.unreadCount, readInboxMaxId: 100 };
}

const CHATS = [
  chat({ id: "1", name: "News", kind: "channel", unreadCount: 50 }),
  chat({ id: "2", name: "Mum", kind: "private", unreadCount: 2 }),
  chat({ id: "3", name: "Family", kind: "group", unreadCount: 9 }),
  chat({ id: "4", name: "Bob", kind: "private", unreadCount: 5 }),
  chat({ id: TELEGRAM_SERVICE_ACCOUNT, name: "Telegram", kind: "private", unreadCount: 1 }),
  chat({ id: "6", name: "Quiet", kind: "private", unreadCount: 0 }),
];

function messages(count: number, hasMedia = false): TelegramMessage[] {
  return Array.from({ length: count }, (_, index) => ({
    id: 101 + index,
    from: "Ann",
    sentAt: new Date(),
    text: `m${index}`,
    hasMedia,
  }));
}

/** A fake Telegram: a chat list, and as many messages per chat as it has unread, within the limit asked for. */
class FakeTelegram implements TelegramChats {
  readonly reads: { chatId: string; afterId: number; limit: number }[] = [];
  closed = false;

  constructor(
    private chats: TelegramChat[],
    private failures: Error[] = [],
  ) {}

  async listChats(): Promise<TelegramChat[]> {
    const failure = this.failures.shift();
    if (failure) throw failure;
    return this.chats;
  }

  async readMessages(chatId: string, afterId: number, limit: number): Promise<TelegramMessage[]> {
    this.reads.push({ chatId, afterId, limit });
    const found = this.chats.find((candidate) => candidate.id === chatId);
    return messages(Math.min(found?.unreadCount ?? 0, limit), chatId === "2");
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

function sourceOn(telegram: FakeTelegram, settings = ALL, waits: number[] = []): TelegramSource {
  return new TelegramSource(
    settings,
    async () => telegram,
    async (ms) => {
      waits.push(ms);
    },
  );
}

async function readChats(settings: TelegramSettings, cursor: SourceCursor = EMPTY_CURSOR): Promise<string[]> {
  const { chats } = await sourceOn(new FakeTelegram(CHATS), settings).read(cursor);
  return chats.map((found) => found.chat);
}

test("telegram: chats all reads every chat with new messages, busiest private chats first", async () => {
  assert.deepEqual(await readChats(ALL), ["Bob", "Mum", "News", "Family"]);
});

test("telegram: a list of chats reads only those", async () => {
  assert.deepEqual(await readChats({ ...ALL, chats: ["family", "Mum"] }), ["Mum", "Family"]);
});

test("telegram: a chat matched by name is remembered by its ID", async () => {
  const { next } = await sourceOn(new FakeTelegram(CHATS), { ...ALL, chats: ["Family"] }).read(EMPTY_CURSOR);
  assert.deepEqual(next.namedChatIds, { Family: "3" });
});

test("telegram: a remembered chat is still read after it is renamed", async () => {
  const renamed = CHATS.map((found) => (found.id === "3" ? { ...found, name: "The Smiths" } : found));
  const telegram = new FakeTelegram(renamed);
  const cursor = { ...EMPTY_CURSOR, namedChatIds: { Family: "3" } };
  const { chats } = await sourceOn(telegram, { ...ALL, chats: ["Family"] }).read(cursor);
  assert.deepEqual(
    chats.map((found) => found.chat),
    ["The Smiths"],
  );
});

test("telegram: missing chats setting reads nothing", async () => {
  assert.deepEqual(await readChats({ ...ALL, chats: [] }), []);
});

test("telegram: excluded chats are skipped", async () => {
  assert.deepEqual(await readChats({ ...ALL, exclude: ["news", "Bob"] }), ["Mum", "Family"]);
});

test("telegram: the service account is never read, even when listed by name", async () => {
  assert.deepEqual(await readChats({ ...ALL, chats: ["Telegram"] }), []);
});

test("telegram: the service account is never read with chats all", async () => {
  const telegram = new FakeTelegram(CHATS);
  await sourceOn(telegram).read(EMPTY_CURSOR);
  assert.ok(!telegram.reads.some((read) => read.chatId === TELEGRAM_SERVICE_ACCOUNT));
});

test("telegram: each chat is read up to its cap", async () => {
  const telegram = new FakeTelegram(CHATS);
  await sourceOn(telegram).read(EMPTY_CURSOR);
  assert.ok(telegram.reads.every((read) => read.limit <= MAX_CHAT_MESSAGES));
});

test("telegram: a capped chat is noted", async () => {
  const { notes } = await sourceOn(new FakeTelegram(CHATS)).read(EMPTY_CURSOR);
  assert.deepEqual(notes, ["Only the latest messages were read in 1 busy chats."]);
});

function manyBusyChats(count: number): TelegramChat[] {
  return Array.from({ length: count }, (_, index) => busyGroup(index));
}

function busyGroup(index: number): TelegramChat {
  return chat({ id: String(1000 + index), name: `Group ${index}`, kind: "group", unreadCount: 40 });
}

test("telegram: the whole catch-up stops at the total cap", async () => {
  const { chats } = await sourceOn(new FakeTelegram(manyBusyChats(20))).read(EMPTY_CURSOR);
  assert.equal(
    chats.reduce((sum, found) => sum + found.messages.length, 0),
    MAX_TOTAL_MESSAGES,
  );
});

test("telegram: the chats that didn't fit are said, with their unread count", async () => {
  const { notes } = await sourceOn(new FakeTelegram(manyBusyChats(20))).read(EMPTY_CURSOR);
  assert.equal(notes.at(-1), "Plus 10 more chats with 400 unread messages; ask about a chat by name.");
});

test("telegram: chats that didn't fit keep their cursor", async () => {
  const { next } = await sourceOn(new FakeTelegram(manyBusyChats(20))).read(EMPTY_CURSOR);
  assert.equal(next.chats["1019"], undefined);
});

test("telegram: media is left out and only flagged", async () => {
  const { chats } = await sourceOn(new FakeTelegram(CHATS)).read(EMPTY_CURSOR);
  const mum = chats.find((found) => found.chat === "Mum");
  assert.deepEqual(mum?.messages[0], { from: "Ann", sentAt: mum?.messages[0].sentAt, text: "m0", hasMedia: true });
});

test("telegram: the cursor moves to each read chat's newest message", async () => {
  const { next } = await sourceOn(new FakeTelegram(CHATS)).read(EMPTY_CURSOR);
  assert.deepEqual(next.chats, { "1": "150", "2": "102", "3": "109", "4": "105" });
});

test("telegram: a chat never read starts after the last message you read in Telegram", async () => {
  const telegram = new FakeTelegram(CHATS);
  await sourceOn(telegram).read(EMPTY_CURSOR);
  assert.equal(telegram.reads[0].afterId, 100);
});

test("telegram: a chat with a cursor and nothing newer isn't read again", async () => {
  const cursor = { ...EMPTY_CURSOR, chats: { "1": "150", "2": "102", "3": "109", "4": "105" } };
  assert.deepEqual(await readChats(ALL, cursor), []);
});

test("telegram: asking for one chat reads it in full", async () => {
  const telegram = new FakeTelegram(CHATS);
  await sourceOn(telegram).read(EMPTY_CURSOR, "family");
  assert.deepEqual(
    telegram.reads.map((read) => [read.chatId, read.limit]),
    [["3", 200]],
  );
});

test("telegram: a short FloodWait is waited out", async () => {
  const waits: number[] = [];
  await sourceOn(new FakeTelegram(CHATS, [new TelegramWaitError(3)]), ALL, waits).read(EMPTY_CURSOR);
  assert.deepEqual(waits, [3000]);
});

test("telegram: a long FloodWait is reported", async () => {
  await assert.rejects(
    sourceOn(new FakeTelegram(CHATS, [new TelegramWaitError(600)])).read(EMPTY_CURSOR),
    /wait 600 seconds/,
  );
});

test("telegram: a revoked session says to log in again, and the connection is closed", async () => {
  const telegram = new FakeTelegram(CHATS, [new Error(LOGIN_AGAIN)]);
  await assert.rejects(sourceOn(telegram).read(EMPTY_CURSOR), /npm run telegram-login/);
  assert.ok(telegram.closed);
});
