import { open } from "node:fs/promises";
import { z } from "zod";

/** Enough of a transcript's start to hold its first prompt and the title Claude Code gave it. */
const HEAD_BYTES = 262_144;

const textBlockSchema = z.object({ type: z.literal("text"), text: z.string() });

const promptEntrySchema = z.object({
  type: z.literal("user"),
  message: z.object({ content: z.union([z.string(), z.array(z.unknown())]) }),
});

const titleEntrySchema = z.object({ type: z.literal("ai-title"), aiTitle: z.string() });

/** What a saved Claude Code conversation starts with. */
export interface TranscriptHead {
  firstPrompt: string;
  title?: string;
}

/** Reads only the start of the transcript: they grow to tens of megabytes. */
export async function readTranscriptHead(file: string): Promise<TranscriptHead> {
  const entries = completeLines(await readHead(file)).map(parsedLine);
  return { firstPrompt: firstPromptOf(entries), title: titleOf(entries) };
}

async function readHead(file: string): Promise<string> {
  const handle = await open(file, "r");
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(HEAD_BYTES), 0, HEAD_BYTES, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

/** The last line may be cut off by the byte limit, so it is dropped; a full file ends in an empty one anyway. */
function completeLines(head: string): string[] {
  return head.split("\n").slice(0, -1);
}

function parsedLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

function firstPromptOf(entries: unknown[]): string {
  for (const entry of entries) {
    const prompt = promptEntrySchema.safeParse(entry);
    if (prompt.success) return promptText(prompt.data.message.content);
  }
  return "";
}

function promptText(content: string | unknown[]): string {
  if (typeof content === "string") return content;
  const texts = content.map((block) => textBlockSchema.safeParse(block)).filter((parsed) => parsed.success);
  return texts.map((parsed) => parsed.data.text).join("\n");
}

function titleOf(entries: unknown[]): string | undefined {
  for (const entry of entries) {
    const title = titleEntrySchema.safeParse(entry);
    if (title.success) return title.data.aiTitle;
  }
  return undefined;
}
