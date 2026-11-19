import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeSlack } from "../../testing/fake-slack.js";
import type { InboundMessage } from "../replies/inbound.js";
import { SlackClient } from "./slack-client.js";
import { SlackConversationReader } from "./slack-conversation-reader.js";

const ACME = { workspace: "acme", profile: "work", channels: [], notify: [], send: true };
const FROM_BOB: InboundMessage = {
  sourceKey: "slack:acme",
  source: "Slack acme",
  chatId: "D1",
  chatKind: "dm",
  from: "Bob",
  messageId: "3.0",
};

function workspace(): FakeSlack {
  return new FakeSlack({
    "auth.test": () => ({ user_id: "UME" }),
    "users.info": (params) => ({ user: { name: params.get("user") === "UME" ? "me" : "Bob" } }),
    "conversations.history": () => ({
      messages: [
        { ts: "3.0", user: "UBOB", text: "and when?" },
        { ts: "2.0", user: "UME", text: "on it" },
        { ts: "1.0", subtype: "channel_join", user: "UBOB" },
      ],
    }),
    "conversations.replies": () => ({ messages: [{ ts: "5.0", user: "UBOB", text: "thread start" }] }),
    "conversations.info": () => ({ channel: { id: "C1", name: "deploys" } }),
  });
}

async function reading(message: InboundMessage, slack = workspace()) {
  const open = async (): Promise<SlackClient> => new SlackClient("xoxp-1", slack.fetch, async () => {});
  return new SlackConversationReader(ACME, open).read(message);
}

test("slack conversation reader: the latest messages come oldest first, yours as You", async () => {
  const { messages } = await reading(FROM_BOB);
  assert.deepEqual(
    messages.map((message) => [message.from, message.text]),
    [
      ["You", "on it"],
      ["Bob", "and when?"],
    ],
  );
});

test("slack conversation reader: it runs on the workspace's account", async () => {
  assert.equal((await reading(FROM_BOB)).profile, "work");
});

test("slack conversation reader: a DM is named after its person", async () => {
  assert.equal((await reading(FROM_BOB)).chatName, "Bob");
});

test("slack conversation reader: a channel is named by Slack's name for it", async () => {
  assert.equal((await reading({ ...FROM_BOB, chatId: "C1", chatKind: "group" })).chatName, "#deploys");
});

test("slack conversation reader: a message in a thread reads the thread", async () => {
  const slack = workspace();
  const { messages } = await reading({ ...FROM_BOB, threadId: "5.0" }, slack);
  assert.deepEqual([messages[0]?.text, slack.callsTo("conversations.replies")[0]?.get("ts")], ["thread start", "5.0"]);
});
