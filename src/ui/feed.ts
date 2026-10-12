import { EventEmitter } from "node:events";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { STATE_DIR } from "../config/paths.js";
import type { AppEvent, AppEvents } from "../events/app-events.js";
import type { ConversationLine, ConversationLines } from "../orchestrator/conversation/conversation-lines.js";
import { feedEntryFor, parseEntries, type FeedEntry, type NewFeedEntry } from "./feed-entry.js";

/**
 * Timeline the UI shows: what you said, what the orchestrator answered, what workers did, what you clicked.
 * Appended line by line to state/feed.jsonl, so restarts, context resets and page reloads keep it;
 * only clear() (the Clear button) empties it. Emits "entry" with each new one, and "cleared".
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

  add(entry: NewFeedEntry): void {
    const full = { ...entry, id: ++this.seq, at: new Date().toISOString() };
    this.entries = [...this.entries, full];
    appendFileSync(this.file, `${JSON.stringify(full)}\n`);
    this.emit("entry", full);
  }

  recent(): FeedEntry[] {
    return this.entries;
  }

  clear(): void {
    this.entries = [];
    writeFileSync(this.file, "");
    this.emit("cleared");
  }

  /** Follow the conversation and worker events. */
  follow(lines: ConversationLines, events: AppEvents): void {
    lines.on("line", ({ role, text, source, session }: ConversationLine) =>
      this.add({ kind: role, text, source, session }),
    );
    events.on("event", (e: AppEvent) => {
      const entry = feedEntryFor(e);
      if (entry) this.add(entry);
    });
  }
}
