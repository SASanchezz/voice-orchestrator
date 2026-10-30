import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { STATE_DIR } from "../../config/paths.js";

/** "specialized": the turn ran as the assistant's agent; "fallback": as plain Claude, which should never happen. */
export type HandledBy = "specialized" | "fallback";

const agentLogEntrySchema = z.discriminatedUnion("event", [
  z.object({ at: z.string(), event: z.literal("startup"), agent: z.string(), source: z.string(), ok: z.literal(true) }),
  z.object({ at: z.string(), event: z.literal("failed_startup"), source: z.string(), error: z.string() }),
  z.object({
    at: z.string(),
    event: z.literal("turn"),
    agent: z.string(),
    handledBy: z.enum(["specialized", "fallback"]),
  }),
]);
export type AgentLogEntry = z.infer<typeof agentLogEntrySchema>;

/** state/assistant-agent.jsonl: which agent the app started with and which handled each assistant turn. */
export function agentLogPath(): string {
  return resolve(STATE_DIR, "assistant-agent.jsonl");
}

export function appendAgentLog(entry: AgentLogEntry, file = agentLogPath()): void {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(entry)}\n`);
}

/** Oldest first; nothing before the first entry is written. */
export function readAgentLog(file = agentLogPath()): AgentLogEntry[] {
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
  return lines.map((line) => agentLogEntrySchema.parse(JSON.parse(line)));
}
