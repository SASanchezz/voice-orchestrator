import assert from "node:assert/strict";
import { test } from "node:test";
import type { SlackWorkspaceSettings } from "../../config/messages-config.js";
import { FakeSlack, type SlackRoute } from "../../testing/fake-slack.js";
import { EMPTY_CURSOR } from "../cursors.js";
import { SlackClient } from "./slack-client.js";
import { SlackReader } from "./slack-reader.js";

const NOW = new Date("2025-11-05T12:00:00.000Z");
const BOB_TS = "1762333300.000200";
const ACME: SlackWorkspaceSettings = { workspace: "acme", profile: "work", channels: [], notify: [] };

const directList: SlackRoute = (params) =>
  params.get("cursor") === "p2"
    ? { channels: [{ id: "G1", is_mpim: true, name: "mpdm-ann--cy-1" }] }
    : { channels: [{ id: "D1", is_im: true, user: "UBOB" }], response_metadata: { next_cursor: "p2" } };

const histories: Record<string, SlackRoute> = {
  D1: (params) =>
    params.get("cursor") === "h2"
      ? { messages: [{ ts: "1762333200.000100", user: "UME", text: "first" }] }
      : { messages: [{ ts: BOB_TS, user: "UBOB", text: "second" }], response_metadata: { next_cursor: "h2" } },
  C1: () => ({ messages: [{ ts: "1762333250.000000", user: "UBOB", text: "standup moved" }] }),
};

const channelList: SlackRoute = () => ({
  channels: [
    { id: "C1", name: "general" },
    { id: "C2", name: "random" },
  ],
});

const noMessages: SlackRoute = () => ({ messages: [] });

const mentionSearch: SlackRoute = () => ({
  messages: {
    matches: [{ ts: "1762333400.000000", user: "UBOB", text: "<@UME> review?", channel: { id: "C9", name: "eng" } }],
  },
});

const WORKSPACE_ROUTES: Record<string, SlackRoute> = {
  "auth.test": () => ({ user_id: "UME" }),
  "conversations.list": (params) => (params.get("types") === "im,mpim" ? directList(params) : channelList(params)),
  "conversations.history": (params) => (histories[params.get("channel") ?? ""] ?? noMessages)(params),
  "users.info": () => ({ user: { name: "bob", real_name: "Bob Stone" } }),
  "search.messages": mentionSearch,
};

function workspaceSlack(overrides: Record<string, SlackRoute> = {}): FakeSlack {
  return new FakeSlack({ ...WORKSPACE_ROUTES, ...overrides });
}

function readerOn(slack: FakeSlack, settings = ACME): SlackReader {
  return new SlackReader(
    settings,
    async () => new SlackClient("xoxp-test", slack.fetch, async () => {}),
    () => NOW,
  );
}

function historyChannels(slack: FakeSlack): string[] {
  return slack.callsTo("conversations.history").map((params) => params.get("channel") ?? "");
}

test("slack reader: a DM is read across pages, oldest first, with names", async () => {
  const { chats } = await readerOn(workspaceSlack()).read(EMPTY_CURSOR);
  assert.deepEqual(
    chats[0].messages.map(({ from, text }) => `${from}: ${text}`),
    ["You: first", "Bob Stone: second"],
  );
});

test("slack reader: every page of conversations.list is looked at", async () => {
  const slack = workspaceSlack();
  await readerOn(slack).read(EMPTY_CURSOR);
  assert.ok(historyChannels(slack).includes("G1"));
});

test("slack reader: mentions elsewhere are grouped by channel", async () => {
  const { chats } = await readerOn(workspaceSlack()).read(EMPTY_CURSOR);
  assert.deepEqual(
    chats.at(-1)?.messages.map((message) => message.text),
    ["@Bob Stone review?"],
  );
});

test("slack reader: the mentions chat is named after its channel", async () => {
  const { chats } = await readerOn(workspaceSlack()).read(EMPTY_CURSOR);
  assert.equal(chats.at(-1)?.chat, "mentions in #eng");
});

test("slack reader: channels aren't read unless named in config", async () => {
  const slack = workspaceSlack();
  await readerOn(slack).read(EMPTY_CURSOR);
  assert.deepEqual(
    historyChannels(slack).filter((channel) => channel.startsWith("C")),
    [],
  );
});

test("slack reader: a channel named in config is read, and only that one", async () => {
  const slack = workspaceSlack();
  await readerOn(slack, { ...ACME, channels: ["General"] }).read(EMPTY_CURSOR);
  assert.deepEqual(
    historyChannels(slack).filter((channel) => channel.startsWith("C")),
    ["C1"],
  );
});

test("slack reader: a user's name is asked for once", async () => {
  const slack = workspaceSlack();
  const reader = readerOn(slack);
  await reader.read(EMPTY_CURSOR);
  await reader.read(EMPTY_CURSOR);
  const asked = slack.callsTo("users.info").map((params) => params.get("user"));
  assert.equal(asked.length, new Set(asked).size);
});

test("slack reader: the cursor moves to each conversation's newest message", async () => {
  const { next } = await readerOn(workspaceSlack()).read(EMPTY_CURSOR);
  assert.deepEqual(next, { checkedAt: NOW.toISOString(), chats: { D1: BOB_TS }, namedChatIds: {} });
});

test("slack reader: the next read starts at the cursor", async () => {
  const slack = workspaceSlack();
  const reader = readerOn(slack);
  const { next } = await reader.read(EMPTY_CURSOR);
  await reader.read(next);
  assert.equal(slack.callsTo("conversations.history").at(-2)?.get("oldest"), BOB_TS);
});

test("slack reader: a quiet workspace has nothing new", async () => {
  const quiet = workspaceSlack({
    "conversations.history": () => ({ messages: [] }),
    "search.messages": () => ({ messages: { matches: [] } }),
  });
  assert.deepEqual((await readerOn(quiet).read(EMPTY_CURSOR)).chats, []);
});

test("slack reader: a missing token stops the workspace with the Keychain's error", async () => {
  const reader = new SlackReader(
    ACME,
    async () => Promise.reject(new Error("No Keychain item")),
    () => NOW,
  );
  await assert.rejects(reader.read(EMPTY_CURSOR), /No Keychain item/);
});

test("slack reader: a failed mention search becomes a note", async () => {
  const slack = workspaceSlack({ "search.messages": () => ({ ok: false, error: "missing_scope" }) });
  const { notes } = await readerOn(slack).read(EMPTY_CURSOR);
  assert.deepEqual(notes, [
    "Mentions in other channels couldn't be searched (Slack search.messages failed: missing_scope).",
  ]);
});

test("slack reader: asking for one chat reads only it and keeps checkedAt", async () => {
  const slack = workspaceSlack();
  const { next } = await readerOn(slack).read(EMPTY_CURSOR, "bob");
  assert.deepEqual(
    { channels: historyChannels(slack), checkedAt: next.checkedAt },
    { channels: ["D1", "D1"], checkedAt: undefined },
  );
});
