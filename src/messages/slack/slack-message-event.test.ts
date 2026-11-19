import assert from "node:assert/strict";
import { test } from "node:test";
import { personMessageOf } from "./slack-message-event.js";

const DM_EVENT = { type: "message", channel: "D1", channel_type: "im", user: "U2", ts: "1.1", text: "hi" };

test("slack message event: a DM is a message from a person", () => {
  assert.deepEqual(personMessageOf(DM_EVENT), {
    chatId: "D1",
    chatKind: "dm",
    user: "U2",
    ts: "1.1",
    threadTs: undefined,
  });
});

test("slack message event: a group DM is kept as one", () => {
  assert.equal(personMessageOf({ ...DM_EVENT, channel_type: "mpim" })?.chatKind, "group-dm");
});

test("slack message event: a channel message is a group's", () => {
  assert.equal(personMessageOf({ ...DM_EVENT, channel_type: "channel" })?.chatKind, "group");
});

test("slack message event: the thread is kept", () => {
  assert.equal(personMessageOf({ ...DM_EVENT, thread_ts: "0.9" })?.threadTs, "0.9");
});

test("slack message event: a shared file counts as said", () => {
  assert.ok(personMessageOf({ ...DM_EVENT, subtype: "file_share" }));
});

test("slack message event: an edit is skipped", () => {
  assert.equal(personMessageOf({ ...DM_EVENT, subtype: "message_changed" }), undefined);
});

test("slack message event: a bot's message is skipped", () => {
  assert.equal(personMessageOf({ ...DM_EVENT, bot_id: "B1" }), undefined);
});

test("slack message event: another event type is skipped", () => {
  assert.equal(personMessageOf({ type: "reaction_added" }), undefined);
});
