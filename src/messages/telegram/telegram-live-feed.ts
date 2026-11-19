import type { TelegramSettings } from "../../config/messages-config.js";
import { errorMessage } from "../../shared/errors.js";
import { EMPTY_CURSOR } from "../cursors.js";
import type { ChatKind, InboundFeed, InboundSink } from "../replies/inbound.js";
import { allowedChats } from "./telegram-chat-choice.js";
import type { IncomingMessage, OpenTelegram, TelegramChatKind, TelegramChats } from "./telegram-port.js";

const SOURCE = "Telegram";
/** Bots and broadcast channels are never answered. */
const KINDS: Partial<Record<TelegramChatKind, ChatKind>> = { private: "dm", group: "group" };

/**
 * New messages from people in the chats the catch-up reads, pushed down the app's one Telegram connection. A chat
 * the list hasn't seen yet (someone writing you for the first time) makes it list the chats again.
 */
export class TelegramLiveFeed implements InboundFeed {
  readonly name = SOURCE;
  private listed = new Set<string>();
  private kinds = new Map<string, ChatKind>();

  constructor(
    private settings: TelegramSettings,
    private open: OpenTelegram,
    private sink: InboundSink,
  ) {}

  async start(): Promise<void> {
    const telegram = await this.open();
    await this.learnChats(telegram);
    telegram.onIncoming((message) => this.passOrLog(telegram, message));
    console.log(`[replies] ${SOURCE}: listening for new messages`);
  }

  private async learnChats(telegram: TelegramChats): Promise<void> {
    const listed = await telegram.listChats();
    const { chats } = allowedChats(listed, this.settings, EMPTY_CURSOR);
    this.listed = new Set(listed.map((chat) => chat.id));
    this.kinds = new Map(chats.flatMap((chat) => TelegramLiveFeed.kindEntry(chat.id, KINDS[chat.kind])));
  }

  private static kindEntry(chatId: string, kind: ChatKind | undefined): [string, ChatKind][] {
    return kind ? [[chatId, kind]] : [];
  }

  private passOrLog(telegram: TelegramChats, message: IncomingMessage): void {
    this.pass(telegram, message).catch((error: unknown) => {
      console.warn(`[replies] ${SOURCE}: a new message was lost: ${errorMessage(error)}`);
    });
  }

  private async pass(telegram: TelegramChats, { chatId, from, messageId }: IncomingMessage): Promise<void> {
    if (!this.listed.has(chatId)) await this.learnChats(telegram);
    const chatKind = this.kinds.get(chatId);
    if (!chatKind) return;
    this.sink.received({ sourceKey: "telegram", source: SOURCE, chatId, chatKind, from, messageId: String(messageId) });
  }
}
