import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatMessage } from "./chat-files.js";
import { trimChat } from "./chat-trim.js";

type Kind = ChatMessage["kind"];

function chatOf(kinds: Kind[]): ChatMessage[] {
  return kinds.map((kind, index) => messageNumbered(kind, index + 1));
}

function messageNumbered(kind: Kind, id: number): ChatMessage {
  return { id, at: "2026-11-21T13:00:00.000Z", kind, text: `${kind} ${id}` };
}

function idsOf(messages: ChatMessage[]): number[] {
  return messages.map((message) => message.id);
}

test("a chat within the limit is kept whole", () => {
  const chat = chatOf(["task", "tool", "reply"]);
  assert.deepEqual(trimChat(chat, 3), chat);
});

test("the oldest tool steps are dropped before the task and replies", () => {
  const chat = chatOf(["task", "tool", "reply", "tool", "tool", "permission"]);
  assert.deepEqual(idsOf(trimChat(chat, 4)), [1, 3, 5, 6]);
});

test("without enough steps to drop, the oldest lines of any kind go", () => {
  const chat = chatOf(["task", "reply", "tool", "status", "reply"]);
  assert.deepEqual(idsOf(trimChat(chat, 3)), [2, 4, 5]);
});
