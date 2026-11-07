import type { MessageCursors } from "./cursors.js";
import type { DigestRequest } from "./message-digest.js";
import type { ReadingLog } from "./message-reading.js";
import { messageCount, type MessageSource, type SourceReading } from "./message-types.js";
import { quoteChats } from "./sanitize.js";

/** Summarizes new messages; tests pass a fake. */
export interface Summarizer {
  summarize(request: DigestRequest): Promise<string>;
}

/** One source's catch-up: read, log the counts, summarize, and only then move its cursor. */
export class SourceCatchUp {
  constructor(
    private digest: Summarizer,
    private cursors: MessageCursors,
    private log: ReadingLog,
  ) {}

  /** The spoken line for the source; throws if reading or summarizing fails, leaving the cursor where it was. */
  async catchUpOn(source: MessageSource, chat: string | undefined): Promise<string> {
    const reading = await source.read(this.cursors.of(source.cursorKey), chat);
    this.log.record(source.name, messageCount(reading.chats), reading.chats.length);
    const spoken = reading.chats.length ? await this.summaryOf(source, reading) : "nothing new.";
    this.cursors.save(source.cursorKey, reading.next);
    return [`${source.name}: ${spoken}`, ...reading.notes].join(" ");
  }

  private async summaryOf(source: MessageSource, reading: SourceReading): Promise<string> {
    const batch = quoteChats(reading.chats);
    const summary = await this.digest.summarize({ source: source.name, profile: source.profile, batch });
    if (!batch.cutMessages) return summary;
    return `${summary} (${batch.cutMessages} more messages were left out to keep it short.)`;
  }
}
