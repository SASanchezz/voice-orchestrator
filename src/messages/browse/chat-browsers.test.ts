import assert from "node:assert/strict";
import { test } from "node:test";
import { ChatBrowsers, type ChatBrowser } from "./chat-browsers.js";

const HELLO = { id: "9", from: "Bob", sentAt: "2026-11-16T09:00:00.000Z", text: "hi", hasMedia: false, files: [] };
const WORKING: ChatBrowser = {
  label: "Telegram",
  sendHint: "",
  listChats: async () => [{ id: "1", name: "Bob", kind: "dm", unread: 2 }],
  readChat: async () => [HELLO],
  downloadFile: async () => Buffer.alloc(0),
  send: async () => {},
};
const BROKEN: ChatBrowser = {
  ...WORKING,
  label: "Slack acme",
  sendHint: "To write here, add send: true",
  listChats: async () => {
    throw new Error("Slack rejected the token");
  },
};

function browsers(): ChatBrowsers {
  return new ChatBrowsers(
    new Map([
      ["slack:acme", BROKEN],
      ["telegram", WORKING],
    ]),
  );
}

test("chat browsers: a source that fails says why, and the others are still listed", async () => {
  const [slack, telegram] = await browsers().allChats();
  assert.deepEqual([slack.problem, telegram.chats.length], ["Slack rejected the token", 1]);
});

test("chat browsers: a source that lists has no problem", async () => {
  const [, telegram] = await browsers().allChats();
  assert.equal(telegram.problem, "");
});

test("chat browsers: reading a source that isn't set up is refused", async () => {
  await assert.rejects(browsers().readChat("slack:other", "C1"), /No messenger called slack:other/);
});

test("chat browsers: a source with a send hint can't be written in", async () => {
  const [slack, telegram] = await browsers().allChats();
  assert.deepEqual([slack.canSend, telegram.canSend], [false, true]);
});

test("chat browsers: the last reading is kept for making tasks", async () => {
  const chats = browsers();
  await chats.readChat("telegram", "1");
  assert.deepEqual(await chats.lastReading("telegram", "1"), [HELLO]);
});
