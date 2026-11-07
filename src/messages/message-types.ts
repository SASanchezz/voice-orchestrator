import type { SourceCursor } from "./cursors.js";

/** One message as a reader got it, before it is cleaned; media is only flagged, never downloaded. */
export interface RawMessage {
  from: string;
  sentAt: Date;
  text: string;
  hasMedia: boolean;
}

/** The new messages of one chat, channel or DM, oldest first. */
export interface ChatReading {
  chat: string;
  messages: RawMessage[];
}

/** What a source read: its new messages, notes on what it left out, and its cursor once they are summarized. */
export interface SourceReading {
  chats: ChatReading[];
  /** Spoken as they are after the summary, e.g. "plus 40 more chats with 300 unread messages". */
  notes: string[];
  next: SourceCursor;
}

export type SourceKind = "slack" | "telegram";

/** A Slack workspace or Telegram: read only when asked, and never written to. */
export interface MessageSource {
  readonly kind: SourceKind;
  /** As spoken and logged, e.g. "Slack acme". */
  readonly name: string;
  /** The Claude account its messages are summarized on. */
  readonly profile: string;
  /** Its entry in state/messages/cursors.json. */
  readonly cursorKey: string;
  /** Its settings in one line, without any message content. */
  describe(): string;
  /** New messages since the cursor; with a chat name, only that chat, in full. */
  read(cursor: SourceCursor, chat?: string): Promise<SourceReading>;
}

export function messageCount(chats: ChatReading[]): number {
  return chats.reduce((sum, chat) => sum + chat.messages.length, 0);
}
