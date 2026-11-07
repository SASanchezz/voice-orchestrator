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

/** A message's text and sender; media is only flagged, never downloaded. */
export interface TelegramMessage {
  id: number;
  from: string;
  sentAt: Date;
  text: string;
  hasMedia: boolean;
}

/** The only things the app can do with Telegram: list chats and read messages. Nothing is sent, deleted or marked read. */
export interface TelegramChats {
  listChats(): Promise<TelegramChat[]>;
  /** A chat's newest `limit` messages after `afterId`, oldest first. */
  readMessages(chatId: string, afterId: number, limit: number): Promise<TelegramMessage[]>;
  /** Disconnects; a new connection is opened for each catch-up. */
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

export const LOGIN_AGAIN = "Telegram isn't signed in: run npm run telegram-login.";
