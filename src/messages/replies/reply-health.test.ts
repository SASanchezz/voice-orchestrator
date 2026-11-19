import assert from "node:assert/strict";
import { test } from "node:test";
import { newDraft } from "./draft-store.js";
import type { InboundMessage } from "./inbound.js";
import { CountedInbox, RecordedDrafts, ReplyHealth } from "./reply-health.js";

const FROM_BOB: InboundMessage = {
  sourceKey: "slack:acme",
  source: "Slack acme",
  chatId: "D1",
  chatKind: "dm",
  from: "Bob",
  messageId: "1",
};
const TRIAGE = { needsReply: true, kind: "question", urgency: "normal" } as const;

test("reply health: a source nothing happened to has not started", () => {
  assert.deepEqual(new ReplyHealth().of("Slack acme"), {
    feed: "not started",
    heard: 0,
    passed: 0,
    drafted: 0,
    notNeeded: 0,
  });
});

test("reply health: a failed feed keeps its reason", () => {
  const health = new ReplyHealth();
  health.feedFailed("Slack acme", "no app-level token");
  assert.deepEqual([health.of("Slack acme").feed, health.of("Slack acme").feedError], ["failed", "no app-level token"]);
});

test("reply health: the counted inbox counts each message and passes it on", () => {
  const health = new ReplyHealth();
  const received: InboundMessage[] = [];
  new CountedInbox({ received: (message) => void received.push(message) }, health).received(FROM_BOB);
  assert.deepEqual([health.of("Slack acme").passed, received.length], [1, 1]);
});

test("reply health: raw events are counted apart from messages", () => {
  const health = new ReplyHealth();
  new CountedInbox({ received: () => {} }, health).heard("Slack acme");
  assert.deepEqual([health.of("Slack acme").heard, health.of("Slack acme").passed], [1, 0]);
});

test("reply health: drafts and messages needing no reply are counted apart", async () => {
  const health = new ReplyHealth();
  const recorded = new RecordedDrafts({ file: async () => {} }, health);
  await recorded.file(newDraft([FROM_BOB], "Bob", { triage: TRIAGE, text: "Sure" }));
  await recorded.file(newDraft([FROM_BOB], "Bob", { triage: TRIAGE }));
  assert.deepEqual([health.of("Slack acme").drafted, health.of("Slack acme").notNeeded], [1, 1]);
});

test("reply health: a draft that couldn't be made keeps its reason", () => {
  const health = new ReplyHealth();
  new RecordedDrafts({ file: async () => {} }, health).failed("Slack acme", "usage limit");
  assert.equal(health.of("Slack acme").lastFailure, "usage limit");
});
