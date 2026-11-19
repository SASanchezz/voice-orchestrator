import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DraftStore, newDraft } from "./draft-store.js";
import type { InboundMessage } from "./inbound.js";

const FROM_BOB: InboundMessage = {
  sourceKey: "slack:acme",
  source: "Slack acme",
  chatId: "D1",
  chatKind: "dm",
  from: "Bob",
  messageId: "1.1",
};
const QUESTION = { needsReply: true, kind: "question", urgency: "normal" } as const;

function storeFile(): string {
  return join(mkdtempSync(join(tmpdir(), "drafts-")), "drafts.json");
}

test("draft: a reply makes a ready draft", () => {
  assert.equal(newDraft([FROM_BOB], "Bob", { triage: QUESTION, text: "Sure" }).status, "ready");
});

test("draft: no reply makes a no-reply draft", () => {
  assert.equal(newDraft([FROM_BOB], "Bob", { triage: QUESTION }).status, "no-reply");
});

test("draft: every message of the burst is answered", () => {
  const second = { ...FROM_BOB, messageId: "1.2" };
  assert.deepEqual(newDraft([FROM_BOB, second], "Bob", { triage: QUESTION }).messageIds, ["1.1", "1.2"]);
});

test("draft store: an added draft is kept", () => {
  const store = new DraftStore(storeFile());
  const draft = newDraft([FROM_BOB], "Bob", { triage: QUESTION, text: "Sure" });
  store.add(draft);
  assert.deepEqual(
    store.all().map((kept) => [kept.id, kept.text]),
    [[draft.id, "Sure"]],
  );
});

test("draft store: only the latest 200 drafts are kept", () => {
  const store = new DraftStore(storeFile());
  for (let index = 0; index < 201; index++) store.add(newDraft([FROM_BOB], "Bob", { triage: QUESTION }));
  assert.equal(store.all().length, 200);
});

test("draft store: a damaged file says so", () => {
  const file = storeFile();
  writeFileSync(file, "[{}]");
  assert.throws(() => new DraftStore(file).all(), /drafts file.*damaged/);
});

test("draft store: a draft is found by its ID", () => {
  const store = new DraftStore(storeFile());
  const draft = newDraft([FROM_BOB], "Bob", { triage: QUESTION, text: "Sure" });
  store.add(draft);
  assert.equal(store.find(draft.id).text, "Sure");
});

test("draft store: an unknown ID says the draft is gone", () => {
  assert.throws(() => new DraftStore(storeFile()).find("nope"), /draft is gone/);
});

test("draft store: an update changes only that draft", () => {
  const store = new DraftStore(storeFile());
  const first = newDraft([FROM_BOB], "Bob", { triage: QUESTION, text: "one" });
  const second = newDraft([FROM_BOB], "Bob", { triage: QUESTION, text: "two" });
  store.add(first);
  store.add(second);
  store.update(first.id, { text: "edited" });
  assert.deepEqual(
    store.all().map((draft) => draft.text),
    ["edited", "two"],
  );
});
