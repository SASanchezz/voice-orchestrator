import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatRule } from "./chat-rules.js";
import type { ChatRef, InboundMessage } from "./inbound.js";
import { BURST_MS, ReplyInbox, type DraftRequests, type MessageBurst, type RuleLookup } from "./reply-inbox.js";

const DRAFTED: ChatRule = { mode: "draft", alert: "popup", priority: "normal", research: "allowed" };

function fromBob(messageId: string, threadId?: string): InboundMessage {
  const message = { sourceKey: "slack:acme", source: "Slack acme", chatId: "D1", chatKind: "dm" as const };
  return { ...message, from: "Bob", messageId, threadId };
}

class FixedRules implements RuleLookup {
  constructor(public rule: ChatRule | Error) {}

  ruleFor(_chat: ChatRef): ChatRule {
    if (this.rule instanceof Error) throw this.rule;
    return this.rule;
  }
}

class Requests implements DraftRequests {
  readonly bursts: MessageBurst[] = [];

  requested(burst: MessageBurst): void {
    this.bursts.push(burst);
  }
}

/** Timers the test fires by hand. */
class Timers {
  readonly waiting: { run: () => void; ms: number }[] = [];
  readonly later = (run: () => void, ms: number): void => void this.waiting.push({ run, ms });

  fireAll(): void {
    for (const timer of this.waiting.splice(0)) timer.run();
  }
}

function inbox(rules = new FixedRules(DRAFTED)): { inbox: ReplyInbox; requests: Requests; timers: Timers } {
  const requests = new Requests();
  const timers = new Timers();
  return { inbox: new ReplyInbox(rules, requests, timers.later), requests, timers };
}

test("reply inbox: nothing is drafted before the burst ends", () => {
  const { inbox: replies, requests } = inbox();
  replies.received(fromBob("1"));
  assert.equal(requests.bursts.length, 0);
});

test("reply inbox: a burst waits the burst time", () => {
  const { inbox: replies, timers } = inbox();
  replies.received(fromBob("1"));
  assert.equal(timers.waiting[0].ms, BURST_MS);
});

test("reply inbox: messages in one burst become one draft request", () => {
  const { inbox: replies, requests, timers } = inbox();
  replies.received(fromBob("1"));
  replies.received(fromBob("2"));
  timers.fireAll();
  assert.deepEqual(
    requests.bursts.map((burst) => burst.messages.map((message) => message.messageId)),
    [["1", "2"]],
  );
});

test("reply inbox: messages in different threads are drafted apart", () => {
  const { inbox: replies, requests, timers } = inbox();
  replies.received(fromBob("1"));
  replies.received(fromBob("2", "1.5"));
  timers.fireAll();
  assert.equal(requests.bursts.length, 2);
});

test("reply inbox: a chat whose rule isn't draft is dropped", () => {
  const { inbox: replies, requests, timers } = inbox(new FixedRules({ ...DRAFTED, mode: "notify" }));
  replies.received(fromBob("1"));
  timers.fireAll();
  assert.equal(requests.bursts.length, 0);
});

test("reply inbox: a rule changed during the burst applies", () => {
  const rules = new FixedRules(DRAFTED);
  const { inbox: replies, requests, timers } = inbox(rules);
  replies.received(fromBob("1"));
  rules.rule = { ...DRAFTED, mode: "ignore" };
  timers.fireAll();
  assert.equal(requests.bursts.length, 0);
});

test("reply inbox: a damaged rules file drafts nothing", () => {
  const { inbox: replies, requests, timers } = inbox(new FixedRules(new Error("damaged")));
  replies.received(fromBob("1"));
  timers.fireAll();
  assert.equal(requests.bursts.length, 0);
});
