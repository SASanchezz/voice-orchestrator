import type { TelegramSettings } from "../../config/messages-config.js";
import type { ArrivalSink, MessageWatch } from "../alerts/arrivals.js";
import { logWatched, watchedAmong } from "../alerts/watched-names.js";
import { EMPTY_CURSOR } from "../cursors.js";
import { allowedChats } from "./telegram-chat-choice.js";
import type { IncomingMessage, OpenTelegram, TelegramChat, TelegramChats } from "./telegram-port.js";

const SOURCE = "Telegram";

/**
 * Telegram pushes new messages down the open connection, so nothing is polled: the watch keeps the app's one
 * connection open and passes on each message others send in a chat under `notify`. Chats are matched once, at
 * start, among those the catch-up reads; a chat joined later is watched from the next start.
 */
export class TelegramWatch implements MessageWatch {
  readonly name = SOURCE;

  constructor(
    private settings: TelegramSettings,
    private open: OpenTelegram,
    private alerts: ArrivalSink,
  ) {}

  async start(): Promise<void> {
    const telegram = await this.open();
    try {
      await this.listen(telegram);
    } catch (error) {
      await telegram.close();
      throw error;
    }
  }

  private async listen(telegram: TelegramChats): Promise<void> {
    const watched = this.watchedChats(await telegram.listChats());
    logWatched(SOURCE, [...watched.values()], this.settings.notify);
    telegram.onIncoming((message) => this.pass(watched, message));
  }

  /** Watched chats' names by chat ID. */
  private watchedChats(listed: TelegramChat[]): Map<string, string> {
    const { chats } = allowedChats(listed, this.settings, EMPTY_CURSOR);
    const watched = watchedAmong(chats, this.settings.notify, (chat) => chat.name);
    return new Map(watched.map((chat) => [chat.id, chat.name]));
  }

  private pass(watched: Map<string, string>, { chatId, from }: IncomingMessage): void {
    const chat = watched.get(chatId);
    if (chat) this.alerts.heard({ source: SOURCE, chat, from });
  }
}
