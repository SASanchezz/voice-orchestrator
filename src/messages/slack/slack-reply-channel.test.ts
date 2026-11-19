import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeSlack } from "../../testing/fake-slack.js";
import { newDraft } from "../replies/draft-store.js";
import type { InboundMessage } from "../replies/inbound.js";
import { SlackClient } from "./slack-client.js";
import { SlackReplyChannel } from "./slack-reply-channel.js";

const FROM_BOB: InboundMessage = {
  sourceKey: "slack:acme",
  source: "Slack acme",
  chatId: "D1",
  chatKind: "dm",
  from: "Bob",
  messageId: "1.1",
};
const QUESTION = { needsReply: true, kind: "question", urgency: "normal" } as const;

async function posted(message: InboundMessage): Promise<URLSearchParams> {
  const slack = new FakeSlack({ "chat.postMessage": () => ({ ts: "2.0" }) });
  const open = async (): Promise<SlackClient> => new SlackClient("xoxp-1", slack.fetch, async () => {});
  const draft = newDraft([message], "Bob", { triage: QUESTION, text: "draft" });
  await new SlackReplyChannel("acme", open).send(draft, "Friday.");
  return slack.callsTo("chat.postMessage")[0];
}

test("slack reply channel: posts the text to the conversation", async () => {
  const params = await posted(FROM_BOB);
  assert.deepEqual([params.get("channel"), params.get("text")], ["D1", "Friday."]);
});

test("slack reply channel: a message outside a thread gets a plain reply", async () => {
  assert.equal((await posted(FROM_BOB)).get("thread_ts"), null);
});

test("slack reply channel: a message in a thread is answered in the thread", async () => {
  assert.equal((await posted({ ...FROM_BOB, threadId: "0.9" })).get("thread_ts"), "0.9");
});
