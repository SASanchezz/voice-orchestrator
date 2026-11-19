import assert from "node:assert/strict";
import { test } from "node:test";
import { DraftNews } from "./draft-news.js";
import { newDraft, type Draft } from "./draft-store.js";

const MESSAGE = { sourceKey: "slack:acme", source: "Slack acme", chatId: "D1", chatKind: "dm" as const };
const TRIAGE = { needsReply: true, kind: "question", urgency: "normal" } as const;

function draft(text?: string): Draft {
  return newDraft([{ ...MESSAGE, from: "Bob", messageId: "1" }], "Bob", { triage: TRIAGE, text });
}

function following(): { news: DraftNews; filed: Draft[]; heard: Draft[] } {
  const filed: Draft[] = [];
  const heard: Draft[] = [];
  const news = new DraftNews({ file: async (filing) => void filed.push(filing) });
  news.follow((ready) => heard.push(ready));
  return { news, filed, heard };
}

test("draft news: every draft is filed", async () => {
  const { news, filed } = following();
  await news.file(draft());
  assert.equal(filed.length, 1);
});

test("draft news: a ready draft is told to followers", async () => {
  const { news, heard } = following();
  await news.file(draft("Friday."));
  assert.equal(heard.length, 1);
});

test("draft news: messages needing no reply aren't told", async () => {
  const { news, heard } = following();
  await news.file(draft());
  assert.equal(heard.length, 0);
});
