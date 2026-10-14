import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAX_ATTACHMENT_BYTES } from "../../attachments/attachment-limits.js";
import { app } from "../support/harness.js";
import { chatHas, feedHas, uiPost } from "../support/helpers.js";

const { core } = app;
const SAVED_PATH = /Attached files:\n- (\S+\/notes\.txt) \(1 KB\)/;

const attachment = (name: string, content: string | Buffer): { name: string; data: string } => ({
  name,
  data: Buffer.from(content).toString("base64"),
});

function savedPath(): string {
  const entry = app.ui.feed.recent().find((e) => SAVED_PATH.test(e.text));
  return entry?.text.match(SAVED_PATH)?.[1] ?? "";
}

test("attachments: a file sent with a message is listed after it", async () => {
  await uiPost("/api/message", { text: "read this", attachments: [attachment("notes.txt", "hello attachment")] });
  await feedHas(SAVED_PATH);
});

test("attachments: the listed file is saved with what was sent", () => {
  assert.equal(readFileSync(savedPath(), "utf8"), "hello attachment");
});

test("attachments: the assistant reads an attached text file", async () => {
  await feedHas(/^hello attachment$/);
});

test("attachments: a message may be only files", async () => {
  await uiPost("/api/message", { text: "", attachments: [attachment("only.txt", "x")] });
  await feedHas(/^Attached files:\n- \S+\/only\.txt/);
});

test("attachments: a message with neither text nor files is refused", async () => {
  assert.equal((await uiPost("/api/message", { text: " " })).status, 400);
});

test("attachments: a file over the limit is refused", async () => {
  const tooBig = attachment("big.bin", Buffer.alloc(MAX_ATTACHMENT_BYTES + 1));
  assert.equal((await uiPost("/api/message", { text: "big", attachments: [tooBig] })).status, 413);
});

test("attachments: a task typed to a session lists its files for the worker", async () => {
  const session = core.registry.activeSession("dbadmin").id;
  await uiPost(`/api/sessions/${session}/tasks`, {
    instruction: "sleep: 1",
    attachments: [attachment("plan.md", "#")],
  });
  await chatHas(session, /sleep: 1\n\nAttached files:\n- \S+\/plan\.md/);
});

test("attachments: the assistant can't read files outside the attachments folder", async () => {
  await uiPost("/api/message", { text: "read this\n\nAttached files:\n- /etc/hosts" });
  await feedHas(/No attached file at \/etc\/hosts/);
});
