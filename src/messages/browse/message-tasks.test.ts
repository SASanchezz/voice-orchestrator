import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AttachmentFiles } from "../../attachments/attachment-files.js";
import type { BrowsedMessageView } from "../../ui/chat-browse-views.js";
import { ChatBrowsers, type ChatBrowser } from "./chat-browsers.js";
import { ChatFiles, MAX_FILE_BYTES } from "./chat-files.js";
import { MessageTasks } from "./message-tasks.js";

const AT = "2026-11-16T09:00:00.000Z";
const MESSAGES: BrowsedMessageView[] = [
  { id: "1", from: "Bob", sentAt: AT, text: "the export crashes\nsee video", hasMedia: true, files: [video("v1")] },
  { id: "2", from: "Ann", sentAt: AT, text: "same here", hasMedia: false, files: [] },
  { id: "3", from: "Bob", sentAt: AT, text: "huge one", hasMedia: true, files: [video("v2", MAX_FILE_BYTES + 1)] },
];
const FAMILY = { source: "telegram", chatId: "7", chatName: "Family" };

function video(id: string, size = 4): BrowsedMessageView["files"][number] {
  return { id, name: `${id}.mp4`, mimeType: "video/mp4", size };
}

function tasks(): { tasks: MessageTasks; downloads: string[] } {
  const downloads: string[] = [];
  const browser: ChatBrowser = {
    label: "Telegram",
    sendHint: "",
    listChats: async () => [],
    readChat: async () => MESSAGES,
    downloadFile: async (_chatId, messageId) => {
      downloads.push(messageId);
      return Buffer.from("film");
    },
    send: async () => {},
  };
  const browsers = new ChatBrowsers(new Map([["telegram", browser]]));
  const files = new ChatFiles(browsers, new AttachmentFiles(join(mkdtempSync(join(tmpdir(), "chat-files-")), "a")));
  return { tasks: new MessageTasks(browsers, files), downloads };
}

test("message tasks: one message is titled with who said what", async () => {
  const { title } = await tasks().tasks.draft(FAMILY, ["1"]);
  assert.equal(title, "Bob: the export crashes");
});

test("message tasks: several messages are titled with the chat, the count and the senders", async () => {
  const { title } = await tasks().tasks.draft(FAMILY, ["2", "1"]);
  assert.equal(title, "Family: 2 messages from Bob, Ann");
});

test("message tasks: the description says where the messages were", async () => {
  const { description } = await tasks().tasks.draft(FAMILY, ["2"]);
  assert.ok(description.startsWith("From Telegram › Family:"));
});

test("message tasks: a message's video is downloaded and listed for the worker", async () => {
  const { description } = await tasks().tasks.draft(FAMILY, ["1"]);
  assert.match(description, /Attached files:\n- .*v1\.mp4 \(/);
});

test("message tasks: a file too big to download is noted, and the task is still drafted", async () => {
  const { description } = await tasks().tasks.draft(FAMILY, ["3"]);
  assert.match(description, /a file couldn't be attached: v2\.mp4 is over 200 MB/);
});

test("message tasks: a file is downloaded once however many tasks use it", async () => {
  const made = tasks();
  await made.tasks.draft(FAMILY, ["1"]);
  await made.tasks.draft(FAMILY, ["1", "2"]);
  assert.deepEqual(made.downloads, ["1"]);
});

test("message tasks: messages no longer in the chat are refused", async () => {
  await assert.rejects(tasks().tasks.draft(FAMILY, ["99"]), /aren't among the chat's latest/);
});
