import { z } from "zod";

/** What Claude Code answers a Bash call sent to the background: its task id, and the file its output goes to. */
const BACKGROUND_STARTED = /with ID: (\S+)\. Output is being written to: (\S+\.output)/;

/** A fresh Claude Code process, which knows of no background task yet. */
const initSchema = z.object({ type: z.literal("system"), subtype: z.literal("init") });

/** Every live background task, sent whenever the set changes. */
const liveTasksSchema = z.object({
  type: z.literal("system"),
  subtype: z.literal("background_tasks_changed"),
  tasks: z.array(z.object({ task_id: z.string(), description: z.string(), ambient: z.boolean().optional() })),
});
export type LiveTask = z.infer<typeof liveTasksSchema>["tasks"][number];

/** A helper agent's latest step. */
const progressSchema = z.object({
  type: z.literal("system"),
  subtype: z.literal("task_progress"),
  task_id: z.string(),
  summary: z.string().optional(),
  last_tool_name: z.string().optional(),
});
export type TaskProgress = z.infer<typeof progressSchema>;

const toolResultsSchema = z.object({
  type: z.literal("user"),
  message: z.object({ content: z.array(z.unknown()) }),
});

const toolResultSchema = z.object({
  type: z.literal("tool_result"),
  content: z.union([z.string(), z.array(z.object({ text: z.string().optional() }))]),
});
type ToolResult = z.infer<typeof toolResultSchema>;

export function isFreshProcess(msg: unknown): boolean {
  return initSchema.safeParse(msg).success;
}

/** The live tasks a message lists; undefined when it isn't such a list. */
export function liveTasksIn(msg: unknown): LiveTask[] | undefined {
  return liveTasksSchema.safeParse(msg).data?.tasks;
}

export function progressIn(msg: unknown): TaskProgress | undefined {
  return progressSchema.safeParse(msg).data;
}

/** The output file of each command a message reports as started in the background, by task id. */
export function backgroundOutputFiles(msg: unknown): Map<string, string> {
  const files = new Map<string, string>();
  for (const text of toolResultTexts(msg)) {
    const match = BACKGROUND_STARTED.exec(text);
    if (match?.[1] && match[2]) files.set(match[1], match[2]);
  }
  return files;
}

function toolResultTexts(msg: unknown): string[] {
  const blocks = toolResultsSchema.safeParse(msg).data?.message.content ?? [];
  const results = blocks.map((block) => toolResultSchema.safeParse(block).data);
  return results.flatMap((result) => (result ? textsOf(result) : []));
}

function textsOf({ content }: ToolResult): string[] {
  if (typeof content === "string") return [content];
  return content.map((part) => part.text ?? "");
}
