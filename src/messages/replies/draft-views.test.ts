import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ConversationReaders, type ConversationReader, type ConversationReading } from "./conversation-reading.js";
import { DraftStore, newDraft, type Draft } from "./draft-store.js";
import { DraftViews } from "./draft-views.js";
import type { InboundMessage } from "./inbound.js";

const MESSAGE = { sourceKey: "slack:acme", source: "Slack acme", chatId: "D1", chatKind: "dm" as const };
const TRIAGE = { needsReply: true, kind: "question", urgency: "high" } as const;
const AT = new Date("2026-11-17T09:00:00Z");

class BobsDm implements ConversationReader {
  readonly asked: InboundMessage[] = [];

  read(message: InboundMessage): Promise<ConversationReading> {
    this.asked.push(message);
    const lines = [
      { from: "Bob", sentAt: AT, text: "my password: hunter2", hasMedia: false },
      { from: "You", sentAt: AT, text: "see https://example.com/a?b=c", hasMedia: false },
    ];
    return Promise.resolve({ chatName: "Bob", profile: "work", messages: lines });
  }
}

function draft(text: string | undefined, messageId = "1"): Draft {
  return newDraft([{ ...MESSAGE, from: "Bob", messageId }], "Bob", { triage: TRIAGE, text });
}

function views(): { views: DraftViews; store: DraftStore; reader: BobsDm } {
  const store = new DraftStore(join(mkdtempSync(join(tmpdir(), "draft-views-")), "drafts.json"));
  const reader = new BobsDm();
  return { views: new DraftViews(store, new ConversationReaders(new Map([["slack:acme", reader]]))), store, reader };
}

test("draft views: only drafts waiting for you are listed, newest first", () => {
  const { views: list, store } = views();
  store.add(draft("first"));
  store.add(draft(undefined));
  store.add(draft("second"));
  assert.deepEqual(
    list.waiting().map((view) => view.text),
    ["second", "first"],
  );
});

test("draft views: a view says who it's for and how urgent", () => {
  const { views: list, store } = views();
  store.add(draft("Friday."));
  const [view] = list.waiting();
  assert.deepEqual([view.from, view.source, view.kind, view.urgency], ["Bob", "Slack acme", "question", "high"]);
});

test("draft views: the conversation is read at the draft's latest message", async () => {
  const { views: list, store, reader } = views();
  const waiting = draft("Friday.", "7.1");
  store.add(waiting);
  await list.context(waiting.id);
  assert.equal(reader.asked[0]?.messageId, "7.1");
});

test("draft views: secrets in the conversation are hidden", async () => {
  const { views: list, store } = views();
  const waiting = draft("Friday.");
  store.add(waiting);
  const [first] = await list.context(waiting.id);
  assert.equal(first?.text, "my password: [hidden]");
});

test("draft views: links in the conversation are cut to their site", async () => {
  const { views: list, store } = views();
  const waiting = draft("Friday.");
  store.add(waiting);
  const lines = await list.context(waiting.id);
  assert.equal(lines[1]?.text, "see [link: example.com]");
});
