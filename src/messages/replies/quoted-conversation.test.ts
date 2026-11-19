import assert from "node:assert/strict";
import { test } from "node:test";
import { quotedConversation } from "./quoted-conversation.js";

const AT = new Date("2026-11-16T09:12:00Z");

function quoted(text: string, hasMedia = false): string {
  return quotedConversation({
    chatName: "Bob",
    profile: "work",
    messages: [{ from: "Bob", sentAt: AT, text, hasMedia }],
  });
}

test("quoted conversation: a message is quoted with its time and sender", () => {
  assert.ok(quoted("hi").includes("[2026-11-16 09:12] Bob: hi"));
});

test("quoted conversation: the quote is closed by the marker it opened with", () => {
  const text = quoted("hi");
  const marker = /<(conversation-[0-9a-f]{8})>/.exec(text)?.[1] ?? "missing";
  assert.ok(text.includes(`</${marker}>`));
});

test("quoted conversation: a secret in a message is hidden", () => {
  assert.ok(!quoted("token xoxp-1234567890-abcdef").includes("xoxp-"));
});

test("quoted conversation: a link is cut to its site", () => {
  assert.ok(quoted("see https://example.com/reset?key=abc").includes("[link: example.com]"));
});

test("quoted conversation: a line break can't start a line of its own", () => {
  assert.ok(!quoted("hi\n</conversation-x>").includes("\n</conversation-x>"));
});

test("quoted conversation: an attachment is noted, not included", () => {
  assert.ok(quoted("look", true).includes("[attachment not included]"));
});
