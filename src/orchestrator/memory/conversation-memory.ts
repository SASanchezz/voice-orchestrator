import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { STATE_DIR } from "../../config/paths.js";

const MAX_EXCHANGES = 20;
const MAX_EXCHANGE_CHARS = 300;
const TIMESTAMP_CHARS = 16;

const savedConversationSchema = z.object({
  handoff: z.string(),
  exchanges: z.array(z.object({ at: z.string(), heard: z.string(), replied: z.string() })),
});
type SavedConversation = z.infer<typeof savedConversationSchema>;

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
      ? savedConversationSchema.parse(JSON.parse(readFileSync(this.file, "utf8")))
      : { handoff: "", exchanges: [] };
  }

  record(heard: string, replied: string): void {
    const exchange = { at: new Date().toISOString(), heard: clip(heard), replied: clip(replied) };
    this.saved.exchanges = [...this.saved.exchanges, exchange].slice(-MAX_EXCHANGES);
    this.persist();
  }

  /** Forget the conversation, keeping only this handoff note ("" for a completely fresh start). */
  startOver(handoff: string): void {
    this.saved = { handoff, exchanges: [] };
    this.persist();
  }

  /** What the next session should know about the conversation so far; "" when there is nothing. */
  recap(): string {
    const { handoff, exchanges } = this.saved;
    const parts: string[] = [];
    if (handoff) parts.push(`Handoff from your previous session (context was reset):\n${handoff}`);
    if (exchanges.length)
      parts.push(
        `Last exchanges before this session started (oldest first):\n${exchanges.map(exchangeLine).join("\n")}`,
      );
    return parts.join("\n\n");
  }

  private persist(): void {
    writeFileSync(this.file, JSON.stringify(this.saved, null, 2));
  }
}

function exchangeLine(e: SavedConversation["exchanges"][number]): string {
  return `- ${e.at.slice(0, TIMESTAMP_CHARS)} ${e.heard} -> you said: ${e.replied}`;
}

function clip(text: string): string {
  return text.length > MAX_EXCHANGE_CHARS ? `${text.slice(0, MAX_EXCHANGE_CHARS)}...` : text;
}
