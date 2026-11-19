import type { TelegramSettings } from "../../config/messages-config.js";
import type { RawMessage } from "../message-types.js";
import type { ConversationReader, ConversationReading } from "../replies/conversation-reading.js";
import type { InboundMessage } from "../replies/inbound.js";
import type { OpenTelegram, TelegramChats } from "./telegram-port.js";

/** How many of the latest messages a draft is made from. */
const RECENT_MESSAGES = 15;
const NEWEST = 0;

/** Reads a Telegram chat's latest messages over the app's one shared connection; nothing is marked read. */
export class TelegramConversationReader implements ConversationReader {
  private chatNames = new Map<string, string>();

  constructor(
    private settings: TelegramSettings,
    private open: OpenTelegram,
  ) {}

  async read(message: InboundMessage): Promise<ConversationReading> {
    const telegram = await this.open();
    try {
      return await this.readWith(telegram, message.chatId);
    } finally {
      await telegram.close();
    }
  }

  private async readWith(telegram: TelegramChats, chatId: string): Promise<ConversationReading> {
    if (!this.chatNames.has(chatId)) await this.learnChats(telegram);
    const messages = await this.latest(telegram, chatId);
    return { chatName: this.chatNames.get(chatId) ?? chatId, profile: this.settings.profile, messages };
  }

  /** A connection opened afresh knows no chats yet, so a failed read lists them and tries once more. */
  private async latest(telegram: TelegramChats, chatId: string): Promise<RawMessage[]> {
    try {
      return await telegram.readMessages(chatId, NEWEST, RECENT_MESSAGES);
    } catch {
      await this.learnChats(telegram);
      return telegram.readMessages(chatId, NEWEST, RECENT_MESSAGES);
    }
  }

  private async learnChats(telegram: TelegramChats): Promise<void> {
    const chats = await telegram.listChats();
    this.chatNames = new Map(chats.map((chat) => [chat.id, chat.name]));
  }
}
