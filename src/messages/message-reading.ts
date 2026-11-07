import type { SourceKind } from "./message-types.js";

/** Which messages to catch up on; everything configured when left empty. */
export interface CatchUpRequest {
  source?: SourceKind;
  /** A Slack workspace's name. */
  workspace?: string;
  /** One chat, channel or DM, read in full. */
  chat?: string;
}

/** What the assistant's message tools use: read and summarize, or list what is set up. Nothing is ever sent. */
export interface MessageReading {
  catchUp(request: CatchUpRequest): Promise<string>;
  sourceList(): string;
}

/** Where catch-ups are logged: only counts, never message text. */
export interface ReadingLog {
  record(source: string, messages: number, chats: number): void;
}
