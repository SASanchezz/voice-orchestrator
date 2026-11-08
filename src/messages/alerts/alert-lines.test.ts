import assert from "node:assert/strict";
import { test } from "node:test";
import { alertLinesOf } from "./alert-lines.js";
import type { Arrival } from "./arrivals.js";

function fromBob(count: number): Arrival[] {
  return Array.from({ length: count }, () => ({ source: "Telegram", chat: "Bob", from: "Bob" }));
}

test("alert lines: one private message names its sender", () => {
  assert.equal(alertLinesOf(fromBob(1)).spoken, "Telegram: a new message from Bob.");
});

test("alert lines: several private messages are counted", () => {
  assert.equal(alertLinesOf(fromBob(3)).spoken, "Telegram: 3 new messages from Bob.");
});

test("alert lines: one group message names the sender and the group", () => {
  const spoken = alertLinesOf([{ source: "Telegram", chat: "Family", from: "Ann" }]).spoken;
  assert.equal(spoken, "Telegram: a new message from Ann in Family.");
});

test("alert lines: several group messages name only the group", () => {
  const arrivals = [
    { source: "Telegram", chat: "Family", from: "Ann" },
    { source: "Telegram", chat: "Family", from: "Cy" },
  ];
  assert.equal(alertLinesOf(arrivals).spoken, "Telegram: 2 new messages in Family.");
});

test("alert lines: each source gets its own sentence, in the order messages arrived", () => {
  const arrivals = [...fromBob(1), { source: "Slack acme", chat: "#deploys", from: "Ann" }, ...fromBob(1)];
  const spoken = alertLinesOf(arrivals).spoken;
  assert.equal(spoken, "Telegram: 2 new messages from Bob. Slack acme: a new message from Ann in #deploys.");
});

test("alert lines: the assistant's note says the messages weren't read", () => {
  assert.equal(
    alertLinesOf(fromBob(1)).note,
    "[NOTICE] New messages arrived (announced only, not read): Telegram: a new message from Bob.",
  );
});
