import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { RecordingChannel } from "../../testing/recording-channel.js";
import { DraftStore, newDraft, type Draft } from "./draft-store.js";
import type { InboundMessage } from "./inbound.js";
import { MessengerPrefill } from "./messenger-prefill.js";
import { ReplyChannels } from "./reply-channel.js";
import { ReplyDesk } from "./reply-desk.js";

const FROM_BOB: InboundMessage = {
  sourceKey: "slack:acme",
  source: "Slack acme",
  chatId: "D1",
  chatKind: "dm",
  from: "Bob",
  messageId: "1.1",
};
const QUESTION = { needsReply: true, kind: "question", urgency: "normal" } as const;

interface Desk {
  desk: ReplyDesk;
  channel: RecordingChannel;
  store: DraftStore;
  draft: Draft;
}

async function deskWithDraft(sourceKey = "slack:acme"): Promise<Desk> {
  const store = new DraftStore(join(mkdtempSync(join(tmpdir(), "desk-")), "drafts.json"));
  const channel = new RecordingChannel();
  const channels = new ReplyChannels(new Map([[sourceKey, channel]]));
  const desk = new ReplyDesk(store, channels, new MessengerPrefill(channels));
  const draft = newDraft([FROM_BOB], "Bob", { triage: QUESTION, text: "Friday." });
  await desk.file(draft);
  return { desk, channel, store, draft };
}

test("reply desk: a filed draft is shown in the messenger's own box", async () => {
  const { channel } = await deskWithDraft();
  assert.deepEqual(channel.prefilled, ["Friday."]);
});

test("reply desk: the approved text is sent exactly", async () => {
  const { desk, channel, draft } = await deskWithDraft();
  await desk.send(draft.id, "Friday, after lunch.");
  assert.deepEqual(channel.sent, ["Friday, after lunch."]);
});

test("reply desk: a sent draft is marked sent with what went out", async () => {
  const { desk, store, draft } = await deskWithDraft();
  await desk.send(draft.id, "Friday!");
  const kept = store.find(draft.id);
  assert.deepEqual([kept.status, kept.text, Boolean(kept.sentAt)], ["sent", "Friday!", true]);
});

test("reply desk: a draft is sent only once", async () => {
  const { desk, draft } = await deskWithDraft();
  await desk.send(draft.id, "Friday.");
  await assert.rejects(desk.send(draft.id, "Friday."), /draft is sent/);
});

test("reply desk: a second send while the first is on its way is refused", async () => {
  const { desk, channel, draft } = await deskWithDraft();
  channel.hold();
  const first = desk.send(draft.id, "Friday.");
  await assert.rejects(desk.send(draft.id, "Friday."), /already being sent/);
  channel.letGo();
  await first;
  assert.equal(channel.sent.length, 1);
});

test("reply desk: text that looks like a secret is refused, not changed", async () => {
  const { desk, channel, draft } = await deskWithDraft();
  await assert.rejects(desk.send(draft.id, "my password: hunter2"), /looks like a password/);
  assert.equal(channel.sent.length, 0);
});

test("reply desk: an empty reply is refused", async () => {
  const { desk, draft } = await deskWithDraft();
  await assert.rejects(desk.send(draft.id, "   "), /empty/);
});

test("reply desk: a failed send leaves the draft waiting", async () => {
  const { desk, channel, store, draft } = await deskWithDraft();
  channel.failSend = new Error("Slack is down");
  await assert.rejects(desk.send(draft.id, "Friday."), /Slack is down/);
  assert.equal(store.find(draft.id).status, "ready");
});

test("reply desk: a sent reply clears the messenger's own box", async () => {
  const { desk, channel, draft } = await deskWithDraft();
  await desk.send(draft.id, "Friday.");
  assert.equal(channel.cleared, 1);
});

test("reply desk: an edit is saved and shown in the messenger", async () => {
  const { desk, channel, store, draft } = await deskWithDraft();
  await desk.edit(draft.id, "Monday.");
  assert.deepEqual([store.find(draft.id).text, channel.prefilled.at(-1)], ["Monday.", "Monday."]);
});

test("reply desk: a dismissed draft can't be sent", async () => {
  const { desk, draft } = await deskWithDraft();
  await desk.dismiss(draft.id);
  await assert.rejects(desk.send(draft.id, "Friday."), /draft is dismissed/);
});

test("reply desk: a source without send: true can't send", async () => {
  const { desk, draft } = await deskWithDraft("telegram");
  await assert.rejects(desk.send(draft.id, "Friday."), /no send: true/);
});
