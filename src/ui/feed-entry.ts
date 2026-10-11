import { z } from "zod";
import type { AppEvent } from "../events/app-events.js";
import { usageLimitMessage } from "../limits/usage-limit.js";

const feedEntrySchema = z.object({
  id: z.number(),
  at: z.string(),
  kind: z.enum(["user", "orchestrator", "event", "action"]),
  text: z.string(),
  /** The project (and session, when it has several) the entry is about. */
  about: z.string().optional(),
  source: z.enum(["voice", "ui"]).optional(),
  failed: z.boolean().optional(),
  /** Long text (a worker's closing note, an error), shown collapsed. */
  detail: z.string().optional(),
  /** Set on the entry for a task that just ended; the page flashes a short notice for it. */
  taskOutcome: z.enum(["done", "failed"]).optional(),
});
export type FeedEntry = z.infer<typeof feedEntrySchema>;
export type NewFeedEntry = Omit<FeedEntry, "id" | "at">;

/** A line cut short by a crash mid-write is skipped rather than losing the whole timeline. */
export function parseEntries(jsonl: string): FeedEntry[] {
  return jsonl
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      const entry = feedEntrySchema.safeParse(parseJson(line));
      return entry.success ? [entry.data] : [];
    });
}

/** What the timeline shows for a worker event; nothing for a permission reminder. */
export function feedEntryFor(e: AppEvent): NewFeedEntry | undefined {
  if (e.kind === "task_done")
    return { kind: "event", about: e.label, text: "finished its task", detail: e.result, taskOutcome: "done" };
  if (e.kind === "task_failed")
    return { kind: "event", about: e.label, text: "failed", detail: e.error, failed: true, taskOutcome: "failed" };
  if (e.kind === "usage_limit") return { kind: "event", about: e.label, text: usageLimitMessage(e), failed: true };
  return e.reminder ? undefined : { kind: "event", about: e.label, text: `asks: ${e.description}` };
}

function parseJson(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}
