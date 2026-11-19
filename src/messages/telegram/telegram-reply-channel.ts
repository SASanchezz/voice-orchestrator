import type { Draft } from "../replies/draft-store.js";
import type { ReplyChannel } from "../replies/reply-channel.js";
import { UnknownChatError, type OpenTelegram, type TelegramChats } from "./telegram-port.js";

const CLEARED = "";

/**
 * Sends over the app's one shared Telegram connection, and keeps the draft in Telegram's own message box on all your
 * devices until it is sent or dismissed. In a group the reply quotes the message it answers; in a DM it doesn't.
 */
export class TelegramReplyChannel implements ReplyChannel {
  constructor(private open: OpenTelegram) {}

  async send(draft: Draft, text: string): Promise<void> {
    await this.using(async (telegram) => telegram.sendMessage(draft.chatId, text, TelegramReplyChannel.quoted(draft)));
  }

  async prefill(draft: Draft, text: string): Promise<void> {
    await this.using(async (telegram) => telegram.saveDraft(draft.chatId, text, TelegramReplyChannel.quoted(draft)));
  }

  async clearPrefill(draft: Draft): Promise<void> {
    await this.using(async (telegram) => telegram.saveDraft(draft.chatId, CLEARED));
  }

  private static quoted({ chatKind, messageIds }: Draft): number | undefined {
    return chatKind === "group" ? Number(messageIds[messageIds.length - 1]) : undefined;
  }

  private async using(act: (telegram: TelegramChats) => Promise<void>): Promise<void> {
    const telegram = await this.open();
    try {
      await this.withChatList(telegram, act);
    } finally {
      await telegram.close();
    }
  }

  /**
   * A connection opened afresh knows no chats yet, so it lists them and tries once more. Only that failure is retried:
   * it happens before anything reaches Telegram, so a reply is never sent twice.
   */
  private async withChatList(telegram: TelegramChats, act: (telegram: TelegramChats) => Promise<void>): Promise<void> {
    try {
      await act(telegram);
    } catch (error) {
      if (!(error instanceof UnknownChatError)) throw error;
      await telegram.listChats();
      await act(telegram);
    }
  }
}
