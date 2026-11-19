import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeSlack } from "../../testing/fake-slack.js";
import type { InboundMessage, InboundSink } from "../replies/inbound.js";
import { SlackClient } from "./slack-client.js";
import { SlackEvents } from "./slack-events.js";
import { openWorkspace } from "./slack-workspace.js";

const LONG_AGO = new Date(Date.now() - 10 * 60_000);
const MOMENTS_AGO = new Date(Date.now() - 5_000);

function event(fields: object): object {
  return { type: "message", channel: "D1", channel_type: "im", user: "UBOB", ts: "2.1", ...fields };
}

class Inbox implements InboundSink {
  readonly messages: InboundMessage[] = [];

  received(message: InboundMessage): void {
    this.messages.push(message);
  }
}

const slack = new FakeSlack({
  "auth.test": () => ({ user_id: "UME" }),
  "users.info": () => ({ user: { name: "Bob" } }),
  "conversations.history": () => ({
    messages: [
      { ts: "3.1", user: "UBOB" },
      { ts: "3.0", user: "UME" },
    ],
  }),
});

async function listening(): Promise<{ events: SlackEvents; inbox: Inbox }> {
  const inbox = new Inbox();
  const workspace = await openWorkspace(
    async () => new SlackClient("xoxp-1", slack.fetch, async () => {}),
    "acme",
    new Map(),
  );
  const events = new SlackEvents("acme", workspace, inbox);
  events.readFrom([
    { id: "D1", kind: "dm", dmUser: "UBOB" },
    { id: "C1", kind: "group", name: "#deploys" },
  ]);
  return { events, inbox };
}

const flush = async (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

test("slack events: a DM reaches the inbox with its sender and message", async () => {
  const { events, inbox } = await listening();
  events.heard(event({}));
  await flush();
  assert.deepEqual(inbox.messages, [
    {
      sourceKey: "slack:acme",
      source: "Slack acme",
      chatId: "D1",
      chatKind: "dm",
      from: "Bob",
      messageId: "2.1",
      threadId: undefined,
    },
  ]);
});

test("slack events: your own message is left out", async () => {
  const { events, inbox } = await listening();
  events.heard(event({ user: "UME" }));
  await flush();
  assert.equal(inbox.messages.length, 0);
});

test("slack events: a channel named in config passes", async () => {
  const { events, inbox } = await listening();
  events.heard(event({ channel: "C1", channel_type: "channel" }));
  await flush();
  assert.equal(inbox.messages.length, 1);
});

test("slack events: a channel not named in config is left out", async () => {
  const { events, inbox } = await listening();
  events.heard(event({ channel: "C9", channel_type: "channel" }));
  await flush();
  assert.equal(inbox.messages.length, 0);
});

test("slack events: after a long drop, what people sent meanwhile is caught up", async () => {
  const { events, inbox } = await listening();
  events.reconnected(LONG_AGO);
  await flush();
  await flush();
  assert.deepEqual(
    inbox.messages.map((message) => [message.chatId, message.messageId]),
    [
      ["D1", "3.1"],
      ["C1", "3.1"],
    ],
  );
});

test("slack events: after a short drop, nothing is read from history", async () => {
  const { events } = await listening();
  const before = slack.callsTo("conversations.history").length;
  events.reconnected(MOMENTS_AGO);
  await flush();
  assert.equal(slack.callsTo("conversations.history").length, before);
});
