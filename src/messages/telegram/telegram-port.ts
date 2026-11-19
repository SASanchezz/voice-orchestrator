export type TelegramChatKind = "private" | "bot" | "group" | "channel";

/** A chat from the chat list; IDs are Telegram's, as text. */
export interface TelegramChat {
  id: string;
  name: string;
  kind: TelegramChatKind;
  unreadCount: number;
  lastMessageId: number;
  /** The last incoming message you read in a Telegram app. */
  readInboxMaxId: number;
}

/** A message's text and sender; media is flagged, and downloaded only when you open it. */
export interface TelegramMessage {
  id: number;
  from: string;
  sentAt: Date;
  text: string;
  hasMedia: boolean;
  /** The photo, video or file it carries, when it carries one. */
  file?: MessageFile;
}

/** What a message's file is, before anything is downloaded. */
export interface MessageFile {
  name: string;
  mimeType: string;
  /** Bytes; 0 when Telegram doesn't say. */
  size: number;
}

/** A message someone else just sent you: only where and from whom, never its text. */
export interface IncomingMessage {
  chatId: string;
  from: string;
  messageId: number;
}

/**
 * The only things the app can do with Telegram: list chats, read messages and download their files, hear of new
 * ones, and send or prefill a message you approved or wrote. Nothing is deleted or marked read.
 */
export interface TelegramChats {
  listChats(): Promise<TelegramChat[]>;
  /** A chat's newest `limit` messages after `afterId`, oldest first. */
  readMessages(chatId: string, afterId: number, limit: number): Promise<TelegramMessage[]>;
  /** The photo, video or file a message carries, downloaded whole. */
  downloadFile(chatId: string, messageId: number): Promise<Buffer>;
  /** Sends a reply you approved; `replyTo` quotes that message. */
  sendMessage(chatId: string, text: string, replyTo?: number): Promise<void>;
  /** Puts `text` in the chat's message box in your Telegram apps; empty text clears it. */
  saveDraft(chatId: string, text: string, replyTo?: number): Promise<void>;
  /** Calls `heard` for each message others send you while this connection stays open. */
  onIncoming(heard: (message: IncomingMessage) => void): void;
  /** Lets go of the connection; the last one to let go disconnects. */
  close(): Promise<void>;
}

/** Connects with the session saved in the Keychain. */
export type OpenTelegram = () => Promise<TelegramChats>;

/** Telegram asked to wait (FloodWait) before the next request. */
export class TelegramWaitError extends Error {
  constructor(readonly seconds: number) {
    super(`Telegram asks to wait ${seconds} seconds; try again later.`);
  }
}

/** The chat isn't in this connection's chat list yet, so nothing was asked of Telegram; list the chats and retry. */
export class UnknownChatError extends Error {
  constructor(chatId: string) {
    super(`chat ${chatId} isn't in the chat list`);
  }
}

export const LOGIN_AGAIN = "Telegram isn't signed in: run npm run telegram-login.";
