import type { TelegramSettings } from "../../config/messages-config.js";
import type { BrowsedChatKind, BrowsedChatView, BrowsedMessageView } from "../../ui/chat-browse-views.js";
import { isNamed } from "../chat-names.js";
import { TELEGRAM_SERVICE_ACCOUNT } from "../telegram/telegram-chat-choice.js";
import {
  UnknownChatError,
  type OpenTelegram,
  type TelegramChat,
  type TelegramChatKind,
  type TelegramChats,
  type TelegramMessage,
} from "../telegram/telegram-port.js";
import { visibleText } from "./browsed-text.js";
import { SHOWN_MESSAGES, type ChatBrowser } from "./chat-browsers.js";

const NEWEST = 0;
const KINDS: Record<TelegramChatKind, BrowsedChatKind> = {
  private: "dm",
  bot: "dm",
  group: "group",
  channel: "channel",
};

/** Every Telegram chat but the excluded ones and the service account, in Telegram's order; nothing is marked read. */
export class TelegramChatBrowser implements ChatBrowser {
  readonly label = "Telegram";
  readonly sendHint = "";

  constructor(
    private settings: TelegramSettings,
    private open: OpenTelegram,
  ) {}

  listChats(): Promise<BrowsedChatView[]> {
    return this.withTelegram(async (telegram) => {
      const chats = await telegram.listChats();
      return chats.filter((chat) => this.isShown(chat)).map((chat) => TelegramChatBrowser.chatView(chat));
    });
  }

  readChat(chatId: string): Promise<BrowsedMessageView[]> {
    return this.inChat(async (telegram) => {
      const messages = await telegram.readMessages(chatId, NEWEST, SHOWN_MESSAGES);
      return messages.map((message) => TelegramChatBrowser.messageView(message));
    });
  }

  /** A Telegram message carries one file, so the file is known by its message. */
  downloadFile(chatId: string, messageId: string): Promise<Buffer> {
    return this.inChat(async (telegram) => telegram.downloadFile(chatId, Number(messageId)));
  }

  send(chatId: string, text: string): Promise<void> {
    return this.inChat(async (telegram) => telegram.sendMessage(chatId, text));
  }

  /**
   * A connection opened afresh knows no chats yet, so an unknown chat lists them and is asked once more. That failure
   * happens before anything reaches Telegram, so a message is never sent twice.
   */
  private inChat<Result>(act: (telegram: TelegramChats) => Promise<Result>): Promise<Result> {
    return this.withTelegram(async (telegram) => {
      try {
        return await act(telegram);
      } catch (error) {
        if (!(error instanceof UnknownChatError)) throw error;
        await telegram.listChats();
        return act(telegram);
      }
    });
  }

  private async withTelegram<Result>(use: (telegram: TelegramChats) => Promise<Result>): Promise<Result> {
    const telegram = await this.open();
    try {
      return await use(telegram);
    } finally {
      await telegram.close();
    }
  }

  private isShown(chat: TelegramChat): boolean {
    const isExcluded = this.settings.exclude.some((name) => isNamed(chat.name, name));
    return chat.id !== TELEGRAM_SERVICE_ACCOUNT && !isExcluded;
  }

  private static chatView(chat: TelegramChat): BrowsedChatView {
    return { id: chat.id, name: chat.name, kind: KINDS[chat.kind], unread: chat.unreadCount };
  }

  private static messageView({ id, from, sentAt, text, hasMedia, file }: TelegramMessage): BrowsedMessageView {
    const files = file ? [{ id: String(id), ...file }] : [];
    return { id: String(id), from, sentAt: sentAt.toISOString(), text: visibleText(text), hasMedia, files };
  }
}
