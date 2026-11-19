import { readFile } from "node:fs/promises";
import { z } from "zod";
import { HEADLESS_NOTE, PARALLEL_WORK_NOTE } from "./task-launcher.js";
import type { SessionMessage } from "./worker-chat.js";
import { stepOf } from "./worker-activity.js";

/** A chat line rebuilt from a saved conversation, for a session not chosen yet. */
export type TranscriptLine = Omit<SessionMessage, "session">;

const entrySchema = z.object({
  type: z.enum(["user", "assistant"]),
  isMeta: z.boolean().optional(),
  isSidechain: z.boolean().optional(),
  timestamp: z.string().optional(),
  message: z.object({ content: z.union([z.string(), z.array(z.unknown())]) }),
});
type Entry = z.infer<typeof entrySchema>;

const textBlockSchema = z.object({ type: z.literal("text"), text: z.string() });
const toolUseBlockSchema = z.object({
  type: z.literal("tool_use"),
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
});

/** Claude Code's own wrappers, such as background task notifications and slash commands, aren't your tasks. */
const WRAPPER_START = "<";
const ADDED_NOTES = [PARALLEL_WORK_NOTE, HEADLESS_NOTE];

/**
 * The chat a closed session had, as the worker saw it: your tasks, its replies and its steps, at the times they were
 * written. Sub-agents' own steps aren't in the transcript, so they don't come back.
 */
export async function readTranscriptChat(file: string): Promise<TranscriptLine[]> {
  const lines = (await readFile(file, "utf8")).split("\n");
  return lines.flatMap(parsedEntry).flatMap(chatLinesOf);
}

function parsedEntry(line: string): Entry[] {
  const entry = entrySchema.safeParse(jsonOf(line));
  const isMainChat = entry.success && !entry.data.isMeta && !entry.data.isSidechain;
  return isMainChat ? [entry.data] : [];
}

function jsonOf(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

function chatLinesOf(entry: Entry): TranscriptLine[] {
  const { content } = entry.message;
  const blocks = typeof content === "string" ? [{ type: "text", text: content }] : content;
  const lines = entry.type === "user" ? blocks.flatMap(taskLineOf) : blocks.flatMap(workerLineOf);
  return lines.map((line) => ({ ...line, at: entry.timestamp }));
}

function taskLineOf(block: unknown): TranscriptLine[] {
  const text = textBlockSchema.safeParse(block);
  if (!text.success) return [];
  const task = withoutAddedNotes(text.data.text).trim();
  const isYours = task !== "" && !task.startsWith(WRAPPER_START);
  return isYours ? [{ kind: "task", text: task }] : [];
}

function withoutAddedNotes(prompt: string): string {
  return ADDED_NOTES.reduce((text, note) => text.replace(note, ""), prompt);
}

/** The worker's words become a reply and its tool calls steps, worded as the live chat words them. */
function workerLineOf(block: unknown): TranscriptLine[] {
  const text = textBlockSchema.safeParse(block);
  if (text.success && text.data.text.trim()) return [{ kind: "reply", text: text.data.text.trim() }];
  const toolUse = toolUseBlockSchema.safeParse(block);
  if (!toolUse.success) return [];
  const { id, name, input } = toolUse.data;
  return [{ kind: "tool", text: stepOf(name, input), toolUseId: id }];
}
