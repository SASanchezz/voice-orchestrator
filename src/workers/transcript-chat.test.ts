import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HEADLESS_NOTE, PARALLEL_WORK_NOTE } from "./task-launcher.js";
import { readTranscriptChat, type TranscriptLine } from "./transcript-chat.js";

function transcriptOf(entries: object[]): string {
  const file = join(mkdtempSync(join(tmpdir(), "vo-transcript-")), "conversation.jsonl");
  writeFileSync(file, entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
  return file;
}

function userEntry(content: unknown, extra: object = {}): object {
  return { type: "user", timestamp: "2026-11-19T07:00:00.000Z", message: { role: "user", content }, ...extra };
}

function assistantEntry(content: unknown[]): object {
  return { type: "assistant", timestamp: "2026-11-19T07:01:00.000Z", message: { role: "assistant", content } };
}

async function chatOf(entries: object[]): Promise<TranscriptLine[]> {
  return await readTranscriptChat(transcriptOf(entries));
}

test("a task comes back without the notes this app adds to every prompt", async () => {
  const [task] = await chatOf([userEntry([{ type: "text", text: `add pauses${PARALLEL_WORK_NOTE}${HEADLESS_NOTE}` }])]);
  assert.equal(task.text, "add pauses");
});

test("a task keeps the time it was sent", async () => {
  const [task] = await chatOf([userEntry("add pauses")]);
  assert.equal(task.at, "2026-11-19T07:00:00.000Z");
});

test("the worker's words come back as a reply", async () => {
  const [reply] = await chatOf([assistantEntry([{ type: "text", text: " Done. " }])]);
  assert.deepEqual([reply.kind, reply.text], ["reply", "Done."]);
});

test("the worker's tool calls come back as steps worded like the live chat", async () => {
  const toolUse = { type: "tool_use", id: "t1", name: "Bash", input: { command: "npm test" } };
  const [step] = await chatOf([assistantEntry([toolUse])]);
  assert.deepEqual([step.kind, step.text, step.toolUseId], ["tool", "Bash npm test", "t1"]);
});

test("tool results, background notifications and Claude Code's own lines are left out", async () => {
  const toolResult = userEntry([{ type: "tool_result", tool_use_id: "t1", content: "ok" }]);
  const notification = userEntry("<task-notification>done</task-notification>");
  const meta = userEntry("Caveat: local commands", { isMeta: true });
  assert.deepEqual(await chatOf([toolResult, notification, meta]), []);
});

test("a later task ends the run before it, as the live chat's status line does", async () => {
  const chat = await chatOf([
    userEntry("first"),
    assistantEntry([{ type: "text", text: "Answer." }]),
    userEntry("second"),
  ]);
  assert.deepEqual(
    chat.map((line) => [line.kind, line.text]),
    [
      ["task", "first"],
      ["reply", "Answer."],
      ["status", "Finished."],
      ["task", "second"],
    ],
  );
});

test("a run's end keeps the time of its last line", async () => {
  const chat = await chatOf([assistantEntry([{ type: "text", text: "Answer." }]), userEntry("next")]);
  assert.equal(chat.find((line) => line.kind === "status")?.at, "2026-11-19T07:01:00.000Z");
});

test("tasks in a row with no worker lines between them add no run end", async () => {
  const chat = await chatOf([userEntry("first"), userEntry("second")]);
  assert.deepEqual(
    chat.map((line) => line.kind),
    ["task", "task"],
  );
});
