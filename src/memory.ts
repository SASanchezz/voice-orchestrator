import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { STATE_DIR } from "./config.js";

const MAX_EXCHANGES = 20;
const MAX_EXCHANGE_CHARS = 300;

export interface Exchange {
  at: string;
  heard: string;
  replied: string;
}

interface SavedConversation {
  handoff: string;
  exchanges: Exchange[];
}

/**
 * The orchestrator's own conversation, kept on disk so a process restart picks up
 * where you left off, not only an in-process context reset.
 */
export class ConversationMemory {
  private file = resolve(STATE_DIR, "conversation.json");
  private saved: SavedConversation;

  constructor() {
    mkdirSync(STATE_DIR, { recursive: true });
    this.saved = existsSync(this.file)
      ? JSON.parse(readFileSync(this.file, "utf8"))
      : { handoff: "", exchanges: [] };
  }

  record(heard: string, replied: string) {
    const exchange = { at: new Date().toISOString(), heard: clip(heard), replied: clip(replied) };
    this.saved.exchanges = [...this.saved.exchanges, exchange].slice(-MAX_EXCHANGES);
    this.persist();
  }

  /** Forget the conversation, keeping only this handoff note ("" for a completely fresh start). */
  startOver(handoff: string) {
    this.saved = { handoff, exchanges: [] };
    this.persist();
  }

  /** What the next session should know about the conversation so far; "" when there is nothing. */
  recap(): string {
    const parts = [];
    if (this.saved.handoff) parts.push(`Handoff from your previous session (context was reset):\n${this.saved.handoff}`);
    if (this.saved.exchanges.length)
      parts.push(
        "Last exchanges before this session started (oldest first):\n" +
          this.saved.exchanges.map((e) => `- ${e.at.slice(0, 16)} ${e.heard} -> you said: ${e.replied}`).join("\n"),
      );
    return parts.join("\n\n");
  }

  private persist() {
    writeFileSync(this.file, JSON.stringify(this.saved, null, 2));
  }
}

const clip = (s: string) => (s.length > MAX_EXCHANGE_CHARS ? `${s.slice(0, MAX_EXCHANGE_CHARS)}...` : s);
