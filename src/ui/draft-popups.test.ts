import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatRule } from "../messages/replies/chat-rules.js";
import { DraftNews } from "../messages/replies/draft-news.js";
import { newDraft, type Draft } from "../messages/replies/draft-store.js";
import { TestDraftPopups } from "../testing/test-draft-popups.js";
import { DraftPopups } from "./draft-popups.js";

const RULE: ChatRule = { mode: "draft", alert: "popup", priority: "normal", research: "allowed" };
const MESSAGE = { sourceKey: "slack:acme", source: "Slack acme", chatId: "D1", chatKind: "dm" as const };
const TRIAGE = { needsReply: true, kind: "question", urgency: "normal" } as const;

/** A chat's rule, or a rules file that can't be read. */
class FixedRule {
  constructor(private rule: ChatRule | Error) {}

  ruleFor(): ChatRule {
    if (this.rule instanceof Error) throw this.rule;
    return this.rule;
  }
}

function draft(text = "Friday, after lunch."): Draft {
  return newDraft([{ ...MESSAGE, from: "Bob", messageId: "1" }], "Bob", { triage: TRIAGE, text });
}

async function shown(rule: ChatRule | Error = RULE, filed = draft()) {
  const device = new TestDraftPopups();
  const opened: string[] = [];
  const news = new DraftNews({ file: async () => {} });
  const rules = new FixedRule(rule);
  new DraftPopups(device, async (id) => void opened.push(id), rules).follow(news);
  await news.file(filed);
  return { device, opened, filed };
}

test("draft popups: a new draft brings up a pop-up naming who it's for", async () => {
  const { device } = await shown();
  assert.equal(device.shown[0]?.content.title, "Reply to Bob · Slack acme");
});

test("draft popups: the pop-up shows the start of the draft", async () => {
  const { device } = await shown();
  assert.equal(device.shown[0]?.content.preview, "Friday, after lunch.");
});

test("draft popups: a long draft is cut in the pop-up", async () => {
  const { device } = await shown(RULE, draft("x".repeat(500)));
  assert.equal(device.shown[0]?.content.preview.length, 141);
});

test("draft popups: Open takes the web UI to the draft and closes the pop-up", async () => {
  const { device, opened, filed } = await shown();
  device.shown[0]?.choose("open");
  assert.deepEqual([opened, device.shown[0]?.closed], [[filed.id], true]);
});

test("draft popups: Later only closes the pop-up", async () => {
  const { device, opened } = await shown();
  device.shown[0]?.choose("later");
  assert.deepEqual([opened.length, device.shown[0]?.closed], [0, true]);
});

test("draft popups: a chat whose rule says no alert gets no pop-up", async () => {
  const { device } = await shown({ ...RULE, alert: "none" });
  assert.equal(device.shown.length, 0);
});

test("draft popups: a rules file that can't be read still shows the pop-up", async () => {
  const { device } = await shown(new Error("damaged"));
  assert.equal(device.shown.length, 1);
});
