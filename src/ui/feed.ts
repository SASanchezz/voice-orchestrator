import { EventEmitter } from "node:events";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { STATE_DIR } from "../config.js";
import type { AppEvent, Registry } from "../registry.js";
import type { ConversationLine, InputSource, Orchestrator } from "../orchestrator.js";

export interface FeedEntry {
  id: number;
  at: string;
  kind: "user" | "orchestrator" | "event" | "action";
  text: string;
  /** The project (and session, when it has several) the entry is about. */
  about?: string;
  source?: InputSource;
  failed?: boolean;
  /** Long text (a worker's closing note, an error), shown collapsed. */
  detail?: string;
  /** Set on the entry for a task that just ended; the page flashes a short notice for it. */
  taskOutcome?: "done" | "failed";
}

/**
 * Timeline the UI shows: what you said, what the orchestrator answered, what workers did, what you clicked.
 * Appended line by line to state/feed.jsonl, so restarts, context resets and page reloads keep it;
 * only clear() (the Clear button) empties it.
 */
export class Feed extends EventEmitter {
  private file = resolve(STATE_DIR, "feed.jsonl");
  private entries: FeedEntry[];
  private seq: number;

  constructor() {
    super();
    mkdirSync(STATE_DIR, { recursive: true });
    this.entries = existsSync(this.file) ? parseEntries(readFileSync(this.file, "utf8")) : [];
    this.seq = this.entries.at(-1)?.id ?? 0;
  }

  add(entry: Omit<FeedEntry, "id" | "at">) {
    const full = { ...entry, id: ++this.seq, at: new Date().toISOString() };
    this.entries = [...this.entries, full];
    appendFileSync(this.file, `${JSON.stringify(full)}\n`);
    this.emit("entry", full);
  }

  recent(): FeedEntry[] {
    return this.entries;
  }

  /** Empties the timeline; listeners get "cleared". */
  clear() {
    this.entries = [];
    writeFileSync(this.file, "");
    this.emit("cleared");
  }

  /** Follow the conversation and worker events. */
  follow(orchestrator: Orchestrator, registry: Registry) {
    orchestrator.on("line", (line: ConversationLine) => this.add({ kind: line.role, text: line.text, source: line.source }));
    registry.on("event", (e: AppEvent) => {
      if (e.kind === "task_done") this.add({ kind: "event", about: e.label, text: "finished its task", detail: e.result, taskOutcome: "done" });
      if (e.kind === "task_failed") this.add({ kind: "event", about: e.label, text: "failed", detail: e.error, failed: true, taskOutcome: "failed" });
      if (e.kind === "permission" && !e.reminder) this.add({ kind: "event", about: e.label, text: `asks: ${e.description}` });
    });
  }
}

/** A line cut short by a crash mid-write is skipped rather than losing the whole timeline. */
function parseEntries(jsonl: string): FeedEntry[] {
  return jsonl.split("\n").filter(Boolean).flatMap((line) => {
    try {
      return [JSON.parse(line) as FeedEntry];
    } catch {
      return [];
    }
  });
}
