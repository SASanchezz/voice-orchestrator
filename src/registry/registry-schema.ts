import { z } from "zod";

// The shape of state/registry.json. Version 2 has sessions; before that, one worker conversation per project.

export const REGISTRY_FILE_VERSION = 2;

const projectStatusSchema = z.enum(["idle", "running", "waiting_permission", "done", "failed", "stopped"]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

/** A finished task, kept across restarts so you can refer back to earlier work. */
const taskRecordSchema = z.object({
  task: z.string(),
  outcome: z.enum(["done", "failed", "stopped"]),
  result: z.string(),
  finishedAt: z.string(),
});
export type TaskRecord = z.infer<typeof taskRecordSchema>;

/** One worker conversation inside a project, like a Claude Code tab in VS Code. */
const sessionStateSchema = z.object({
  id: z.string(),
  project: z.string(),
  /** Spoken and shown as "session 2"; unique among the project's open sessions. */
  number: z.number(),
  status: projectStatusSchema,
  /** Claude Code's own session id, resumed by the next task. */
  claudeSessionId: z.string().optional(),
  task: z.string().optional(),
  queued: z.array(z.string()),
  /** When an instruction was last queued; the page lists projects by their latest activity. */
  queuedAt: z.string().optional(),
  lastResult: z.string().optional(),
  lastError: z.string().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  /** Last tool the worker used, for "what is it doing" questions. */
  lastActivity: z.string().optional(),
  costUsd: z.number(),
  /** The SDK's running cost total for the current Claude conversation, as last reported; a resumed one continues it. */
  conversationCostUsd: z.number().optional(),
  /** Tokens the worker's latest call read: how full its context is. */
  contextTokens: z.number().optional(),
  /** The context window its model reported. */
  contextWindow: z.number().optional(),
  /** The summary of the session this one took over from; its first task starts with it. */
  handoff: z.string().optional(),
  history: z.array(taskRecordSchema),
});
export type SessionState = z.infer<typeof sessionStateSchema>;
export type SessionPatch = Partial<Omit<SessionState, "id" | "project" | "number">>;

const projectStateSchema = z.object({
  name: z.string(),
  profile: z.string(),
  /** Session that gets the project's tasks unless one is named. */
  activeSession: z.string(),
});
export type ProjectState = z.infer<typeof projectStateSchema>;
export type ProjectPatch = Partial<Omit<ProjectState, "name">>;

export const savedRegistrySchema = z.object({
  version: z.literal(REGISTRY_FILE_VERSION),
  projects: z.record(z.string(), projectStateSchema),
  sessions: z.record(z.string(), sessionStateSchema),
});
export type SavedRegistry = z.infer<typeof savedRegistrySchema>;

const legacyProjectSchema = z.object({
  profile: z.string(),
  sessionId: z.string().optional(),
  lastResult: z.string().optional(),
  costUsd: z.number().optional(),
  history: z.array(taskRecordSchema).optional(),
  status: projectStatusSchema.optional(),
});
export const legacyRegistrySchema = z.record(z.string(), legacyProjectSchema);
export type LegacyRegistry = z.infer<typeof legacyRegistrySchema>;
