import type {
  IncomingMessage,
  TelegramChat,
  TelegramChatKind,
  TelegramChats,
  TelegramMessage,
} from "../messages/telegram/telegram-port.js";

export function telegramChat(id: string, name: string, kind: TelegramChatKind = "private"): TelegramChat {
  return { id, name, kind, unreadCount: 0, lastMessageId: 1, readInboxMaxId: 1 };
}

/** A Telegram whose chat list the test sets, and whose new messages the test sends; no network. */
export class PushingTelegram implements TelegramChats {
  closed = false;
  listings = 0;
  /** What every chat's latest messages read as. */
  messages: TelegramMessage[] = [];
  private heard?: (message: IncomingMessage) => void;

  constructor(public chats: TelegramChat[] = [telegramChat("1", "Bob"), telegramChat("2", "Ann")]) {}

  async listChats(): Promise<TelegramChat[]> {
    this.listings++;
    return this.chats;
  }

  async readMessages(): Promise<TelegramMessage[]> {
    return this.messages;
  }

  /** What every message's file downloads as. */
  fileBytes = Buffer.from("file");
  readonly downloads: { chatId: string; messageId: number }[] = [];

  async downloadFile(chatId: string, messageId: number): Promise<Buffer> {
    this.downloads.push({ chatId, messageId });
    return this.fileBytes;
  }

  /** What was sent and prefilled, in order. */
  readonly sent: { chatId: string; text: string; replyTo?: number }[] = [];
  readonly drafts: { chatId: string; text: string; replyTo?: number }[] = [];

  async sendMessage(chatId: string, text: string, replyTo?: number): Promise<void> {
    this.sent.push({ chatId, text, replyTo });
  }

  async saveDraft(chatId: string, text: string, replyTo?: number): Promise<void> {
    this.drafts.push({ chatId, text, replyTo });
  }

  onIncoming(heard: (message: IncomingMessage) => void): void {
    this.heard = heard;
  }

  push(message: IncomingMessage): void {
    this.heard?.(message);
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}
