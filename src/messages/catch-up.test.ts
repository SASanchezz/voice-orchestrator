import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { MessageCatchUp, READING_OFF } from "./catch-up.js";
import { EMPTY_CURSOR, MessageCursors, type SourceCursor } from "./cursors.js";
import type { ReadingLog } from "./message-reading.js";
import type { ChatReading, MessageSource, SourceKind } from "./message-types.js";
import { SourceCatchUp, type Summarizer } from "./source-catch-up.js";

const NEXT: SourceCursor = { checkedAt: "2026-11-05T10:00:00.000Z", chats: { D1: "2" }, namedChatIds: {} };
const BOB: ChatReading = {
  chat: "Bob",
  messages: [{ from: "Bob", sentAt: new Date(), text: "secret plans", hasMedia: false }],
};

function source(name: string, kind: SourceKind, chats: ChatReading[]): MessageSource {
  return {
    kind,
    name,
    profile: "work",
    cursorKey: name,
    describe: () => `${name} on work`,
    read: async () => ({ chats, notes: ["plus 2 more chats."], next: NEXT }),
  };
}

function failing(name: string): MessageSource {
  return { ...source(name, "slack", []), read: async () => Promise.reject(new Error("token expired")) };
}

const summarizing: Summarizer = { summarize: async ({ source: name }) => `summary of ${name}.` };
const notSummarizing: Summarizer = { summarize: async () => Promise.reject(new Error("model down")) };

interface Logged {
  source: string;
  messages: number;
  chats: number;
}

function catchUpOn(sources: MessageSource[], digest = summarizing) {
  const cursors = new MessageCursors(join(mkdtempSync(join(tmpdir(), "catch-up-")), "cursors.json"));
  const logged: Logged[] = [];
  const log: ReadingLog = { record: (name, messages, chats) => logged.push({ source: name, messages, chats }) };
  return { catchUp: new MessageCatchUp(sources, new SourceCatchUp(digest, cursors, log)), cursors, logged };
}

test("catch-up: speaks each source's summary and what didn't fit", async () => {
  const { catchUp } = catchUpOn([source("Slack acme", "slack", [BOB])]);
  assert.equal(await catchUp.catchUp({}), "Slack acme: summary of Slack acme. plus 2 more chats.");
});

test("catch-up: the cursor moves forward once the summary is made", async () => {
  const { catchUp, cursors } = catchUpOn([source("Slack acme", "slack", [BOB])]);
  await catchUp.catchUp({});
  assert.deepEqual(cursors.of("Slack acme"), NEXT);
});

test("catch-up: the cursor stays when the summary fails", async () => {
  const { catchUp, cursors } = catchUpOn([source("Slack acme", "slack", [BOB])], notSummarizing);
  await catchUp.catchUp({});
  assert.deepEqual(cursors.of("Slack acme"), EMPTY_CURSOR);
});

test("catch-up: with nothing new it says so without summarizing", async () => {
  const { catchUp } = catchUpOn([source("Slack acme", "slack", [])], notSummarizing);
  assert.equal(await catchUp.catchUp({}), "Slack acme: nothing new. plus 2 more chats.");
});

test("catch-up: a failing workspace is reported and the others still read", async () => {
  const { catchUp } = catchUpOn([failing("Slack acme"), source("Slack home", "slack", [BOB])]);
  assert.equal(
    await catchUp.catchUp({}),
    "Slack acme: couldn't read it: token expired\nSlack home: summary of Slack home. plus 2 more chats.",
  );
});

test("catch-up: a source kind reads only that kind", async () => {
  const { catchUp } = catchUpOn([source("Slack acme", "slack", [BOB]), source("Telegram", "telegram", [])]);
  assert.equal(await catchUp.catchUp({ source: "telegram" }), "Telegram: nothing new. plus 2 more chats.");
});

test("catch-up: a workspace is matched loosely by name", async () => {
  const { catchUp } = catchUpOn([source("Slack acme", "slack", []), source("Slack home", "slack", [])]);
  assert.match(await catchUp.catchUp({ workspace: "Home" }), /^Slack home: nothing new/);
});

test("catch-up: an unknown workspace names the ones set up", async () => {
  const { catchUp } = catchUpOn([source("Slack acme", "slack", [])]);
  await assert.rejects(catchUp.catchUp({ workspace: "globex" }), /Set up: Slack acme/);
});

test("catch-up: an unconfigured kind says it isn't set up", async () => {
  const { catchUp } = catchUpOn([source("Slack acme", "slack", [])]);
  await assert.rejects(catchUp.catchUp({ source: "telegram" }), /Telegram isn't set up/);
});

test("catch-up: without a messages block, catching up says reading is off", async () => {
  await assert.rejects(catchUpOn([]).catchUp.catchUp({}), { message: READING_OFF });
});

test("catch-up: without a messages block, the source list says reading is off", () => {
  assert.equal(catchUpOn([]).catchUp.sourceList(), READING_OFF);
});

test("catch-up: the source list describes each source", () => {
  assert.equal(catchUpOn([source("Slack acme", "slack", [])]).catchUp.sourceList(), "- Slack acme on work");
});

test("catch-up: only counts are logged", async () => {
  const { catchUp, logged } = catchUpOn([source("Slack acme", "slack", [BOB])]);
  await catchUp.catchUp({});
  assert.deepEqual(logged, [{ source: "Slack acme", messages: 1, chats: 1 }]);
});
