import assert from "node:assert/strict";
import { test } from "node:test";
import type { RawMessage } from "./message-types.js";
import { cleanName, cleanText, MAX_BATCH_CHARS, MAX_MESSAGE_CHARS, MEDIA_LEFT_OUT, quoteChats } from "./sanitize.js";

const SENT_AT = new Date("2026-11-05T09:00:00Z");

function message(text: string, hasMedia = false): RawMessage {
  return { from: "Bob", sentAt: SENT_AT, text, hasMedia };
}

test("sanitize: zero-width and bidi characters are removed", () => {
  assert.equal(cleanText("he\u200Bllo \u202Eworld\u2066"), "hello world");
});

test("sanitize: hidden Unicode tag characters are removed", () => {
  assert.equal(cleanText("hi\u{E0049}\u{E0047}\u{E004E}"), "hi");
});

test("sanitize: control characters are removed", () => {
  assert.equal(cleanText("a\u0000b\u0007c\u001Bd"), "abcd");
});

test("sanitize: line breaks become single spaces", () => {
  assert.equal(cleanText("first line\n\n  second line"), "first line second line");
});

test("sanitize: a link is reduced to its domain", () => {
  assert.equal(cleanText("see https://docs.acme.com/a/b?token=x#y now"), "see [link: docs.acme.com] now");
});

test("sanitize: a link's user and password never show", () => {
  assert.equal(cleanText("https://me:hunter2@git.acme.com/repo"), "[link: git.acme.com]");
});

test("sanitize: a media message keeps its caption and says the attachment was left out", () => {
  const [chat] = quoteChats([{ chat: "Bob", messages: [message("our trip", true)] }]).chats;
  assert.equal(chat.messages[0].text, `our trip ${MEDIA_LEFT_OUT}`);
});

test("sanitize: a media-only message says only that the attachment was left out", () => {
  const [chat] = quoteChats([{ chat: "Bob", messages: [message("", true)] }]).chats;
  assert.equal(chat.messages[0].text, MEDIA_LEFT_OUT);
});

test("sanitize: a long message is cut to the set length", () => {
  const cut = cleanText("word ".repeat(MAX_MESSAGE_CHARS));
  assert.equal(cut.length, MAX_MESSAGE_CHARS);
});

test("sanitize: a long name is cut short", () => {
  assert.ok(cleanName("x".repeat(500)).length < MAX_MESSAGE_CHARS);
});

test("sanitize: the batch stops at the total length and counts what was cut", () => {
  const long = message("y".repeat(MAX_MESSAGE_CHARS));
  const messages = Array.from({ length: MAX_BATCH_CHARS / MAX_MESSAGE_CHARS + 5 }, () => long);
  const batch = quoteChats([
    { chat: "A", messages },
    { chat: "B", messages: [long] },
  ]);
  const kept = batch.chats.reduce((sum, chat) => sum + chat.messages.length, 0);
  assert.equal(kept + batch.cutMessages, messages.length + 1);
});

test("sanitize: a chat with nothing left after the cut is dropped", () => {
  const long = message("y".repeat(MAX_MESSAGE_CHARS));
  const messages = Array.from({ length: MAX_BATCH_CHARS / MAX_MESSAGE_CHARS + 5 }, () => long);
  const batch = quoteChats([
    { chat: "A", messages },
    { chat: "B", messages: [long] },
  ]);
  assert.deepEqual(
    batch.chats.map((chat) => chat.chat),
    ["A"],
  );
});

test("sanitize: a one-time code is hidden", () => {
  assert.equal(cleanText("Your login code is 482913"), "Your login code is [hidden]");
});

test("sanitize: a number without a code word stays", () => {
  assert.equal(cleanText("We sold 4829 units"), "We sold 4829 units");
});

test("sanitize: a password is hidden", () => {
  assert.equal(cleanText("wifi password: hunter2!"), "wifi password: [hidden]");
});

test("sanitize: a Russian password is hidden", () => {
  assert.equal(cleanText("пароль: qwerty"), "пароль: [hidden]");
});

test("sanitize: a token is hidden", () => {
  assert.equal(cleanText("use xoxp-1234567890-abcdef please"), "use [hidden] please");
});

test("sanitize: a random-looking key is hidden", () => {
  assert.equal(cleanText("key a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7"), "key [hidden]");
});

test("sanitize: a card number is hidden", () => {
  assert.equal(cleanText("card 4111 1111 1111 1111 exp 12/29"), "card [hidden] exp 12/29");
});

test("sanitize: a private key is hidden", () => {
  const key = "-----BEGIN RSA PRIVATE KEY-----\nMIIEow\nIBAAK\n-----END RSA PRIVATE KEY-----";
  assert.equal(cleanText(`here: ${key} thanks`), "here: [hidden] thanks");
});
