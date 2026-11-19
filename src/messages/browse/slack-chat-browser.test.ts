import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeSlack, type SlackRoute } from "../../testing/fake-slack.js";
import { SlackClient } from "../slack/slack-client.js";
import { SlackChatBrowser } from "./slack-chat-browser.js";

const ACME = { workspace: "acme", profile: "work", channels: [], notify: [], send: false };
const SENDING = { ...ACME, send: true };
const CONVERSATIONS = [
  { id: "C2", name: "deploys" },
  { id: "D1", is_im: true, user: "UBOB" },
  { id: "G1", is_mpim: true, name: "mpdm-ann--bob-1" },
  { id: "D2", is_im: true, user: "UGONE", is_user_deleted: true },
];

const CRASH_REPORT = {
  ts: "3.0",
  user: "UBOB",
  text: "deploy <@UME>?\u200b",
  files: [{ id: "F1", name: "crash.mov", mimetype: "video/quicktime", size: 5 }, { mode: "tombstone" }],
};
const HISTORY = [CRASH_REPORT, { ts: "2.0", user: "UME", text: "on it" }, { ts: "1.0", subtype: "channel_join" }];

function workspace(routes: Record<string, SlackRoute> = {}): FakeSlack {
  return new FakeSlack({
    "auth.test": () => ({ user_id: "UME" }),
    "users.list": () => ({ members: [{ id: "UBOB", name: "bob", real_name: "Bob" }] }),
    "users.conversations": () => ({ channels: CONVERSATIONS }),
    "conversations.history": () => ({ messages: HISTORY }),
    "users.info": (params) => ({ user: { name: params.get("user") === "UME" ? "me" : "Bob" } }),
    ...routes,
  });
}

function browser(slack: FakeSlack, settings = ACME): SlackChatBrowser {
  return new SlackChatBrowser(settings, async () => new SlackClient("xoxp-1", slack.fetch, async () => {}));
}

test("slack chat browser: DMs come first, then group DMs, then channels", async () => {
  const chats = await browser(workspace()).listChats();
  assert.deepEqual(
    chats.map((chat) => [chat.name, chat.kind]),
    [
      ["Bob", "dm"],
      ["ann, bob", "group-dm"],
      ["#deploys", "channel"],
    ],
  );
});

test("slack chat browser: DMs are named from one users.list, not a users.info each", async () => {
  const slack = workspace();
  await browser(slack).listChats();
  assert.equal(slack.callsTo("users.info").length, 0);
});

test("slack chat browser: every conversation kind you are in is asked for", async () => {
  const slack = workspace();
  await browser(slack).listChats();
  assert.equal(slack.callsTo("users.conversations")[0].get("types"), "im,mpim,public_channel,private_channel");
});

test("slack chat browser: without the channel scopes, your DMs are still listed", async () => {
  const slack = workspace({
    "users.conversations": (params) =>
      params.get("types") === "im,mpim"
        ? { channels: CONVERSATIONS.slice(1, 3) }
        : { ok: false, error: "missing_scope" },
  });
  assert.deepEqual(
    (await browser(slack).listChats()).map((chat) => chat.id),
    ["D1", "G1"],
  );
});

test("slack chat browser: a chat's messages come oldest first, notices left out, yours as You", async () => {
  const messages = await browser(workspace()).readChat("C2");
  assert.deepEqual(
    messages.map((message) => message.from),
    ["You", "Bob"],
  );
});

test("slack chat browser: a message's text has names for mentions and no invisible characters", async () => {
  const messages = await browser(workspace()).readChat("C2");
  assert.equal(messages[1].text, "deploy @me?");
});

test("slack chat browser: a message is known by its ts", async () => {
  const messages = await browser(workspace()).readChat("C2");
  assert.equal(messages[1].id, "3.0");
});

test("slack chat browser: a message's files are offered, ones without an ID left out", async () => {
  const messages = await browser(workspace()).readChat("C2");
  assert.deepEqual(messages[1].files, [{ id: "F1", name: "crash.mov", mimeType: "video/quicktime", size: 5 }]);
});

test("slack chat browser: without send: true, writing is refused before Slack is asked", async () => {
  const slack = workspace();
  await assert.rejects(browser(slack).send("C2", "hi"), /add send: true/);
  assert.equal(slack.callsTo("chat.postMessage").length, 0);
});

test("slack chat browser: with send: true, what you write is posted to the chat", async () => {
  const slack = workspace({ "chat.postMessage": () => ({ ts: "4.0" }) });
  await browser(slack, SENDING).send("C2", "on it");
  assert.equal(slack.callsTo("chat.postMessage")[0].get("text"), "on it");
});

test("slack chat browser: a file's download link is asked for by its ID", async () => {
  const slack = workspace({ "files.info": () => ({ file: { url_private_download: "https://evil.example/f" } }) });
  await assert.rejects(browser(slack).downloadFile("C2", "3.0", "F1"), /Not a Slack file/);
});
