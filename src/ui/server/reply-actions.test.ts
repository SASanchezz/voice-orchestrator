import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DraftStore, newDraft, type Draft } from "../../messages/replies/draft-store.js";
import { MessengerPrefill } from "../../messages/replies/messenger-prefill.js";
import { ReplyChannels } from "../../messages/replies/reply-channel.js";
import { ReplyDesk } from "../../messages/replies/reply-desk.js";
import { SpokenSend } from "../../messages/replies/spoken-send.js";
import { RecordingChannel } from "../../testing/recording-channel.js";
import { ReplyActions } from "./reply-actions.js";

const MESSAGE = { sourceKey: "slack:acme", source: "Slack acme", chatId: "D1", chatKind: "dm" as const };
const TRIAGE = { needsReply: true, kind: "question", urgency: "normal" } as const;

interface Page {
  actions: ReplyActions;
  spoken: SpokenSend;
  channel: RecordingChannel;
  draft: Draft;
}

async function page(): Promise<Page> {
  const store = new DraftStore(join(mkdtempSync(join(tmpdir(), "reply-actions-")), "drafts.json"));
  const channel = new RecordingChannel();
  const channels = new ReplyChannels(new Map([["slack:acme", channel]]));
  const desk = new ReplyDesk(store, channels, new MessengerPrefill(channels));
  const draft = newDraft([{ ...MESSAGE, from: "Bob", messageId: "1" }], "Bob", { triage: TRIAGE, text: "Friday." });
  await desk.file(draft);
  const spoken = new SpokenSend(desk, () => {});
  return { actions: new ReplyActions(desk, spoken), spoken, channel, draft };
}

const flush = async (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

test("reply actions: Send says who it went to", async () => {
  const { actions, draft } = await page();
  assert.equal(await actions.send(draft.id, { text: "Friday." }), "Sent to Bob.");
});

test("reply actions: the text is sent as the page showed it, spaces included", async () => {
  const { actions, channel, draft } = await page();
  await actions.send(draft.id, { text: "  Friday.\n" });
  assert.deepEqual(channel.sent, ["  Friday.\n"]);
});

test("reply actions: an edited draft is what confirm send sends", async () => {
  const { actions, spoken, channel, draft } = await page();
  await actions.edit(draft.id, { text: "Monday." });
  spoken.answer("confirm send");
  await flush();
  assert.deepEqual(channel.sent, ["Monday."]);
});

test("reply actions: after a click on Send, confirm send has nothing to send", async () => {
  const { actions, spoken, channel, draft } = await page();
  actions.arm(draft.id, { text: "Friday." });
  await actions.send(draft.id, { text: "Friday." });
  spoken.answer("confirm send");
  await flush();
  assert.equal(channel.sent.length, 1);
});

test("reply actions: a body without text is refused", async () => {
  const { actions, draft } = await page();
  await assert.rejects(actions.send(draft.id, {}));
});
