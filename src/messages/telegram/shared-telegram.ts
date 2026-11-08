import type { IncomingMessage, OpenTelegram, TelegramChat, TelegramChats, TelegramMessage } from "./telegram-port.js";

/**
 * One Telegram connection for the whole app. Two connections on the same login at once can make Telegram reject
 * it, and the new-message watch keeps one open, so catch-ups and the startup check borrow that one. The last
 * holder to let go disconnects; a connection that failed to open is tried afresh next time.
 */
export class SharedTelegram {
  private connection?: Promise<TelegramChats>;
  private holders = 0;

  constructor(private connect: OpenTelegram) {}

  /** The app's way to open Telegram: each caller's close() only lets go of its own hold. */
  readonly open: OpenTelegram = async () => {
    const chats = await this.connected();
    this.holders++;
    return new HeldTelegram(chats, () => this.release());
  };

  private async connected(): Promise<TelegramChats> {
    this.connection ??= this.connect();
    try {
      return await this.connection;
    } catch (error) {
      this.connection = undefined;
      throw error;
    }
  }

  private async release(): Promise<void> {
    this.holders--;
    if (this.holders > 0 || !this.connection) return;
    const closing = this.connection;
    this.connection = undefined;
    await (await closing).close();
  }
}

/** One holder's view of the shared connection; closing it twice lets go only once. */
class HeldTelegram implements TelegramChats {
  private released = false;

  constructor(
    private chats: TelegramChats,
    private letGo: () => Promise<void>,
  ) {}

  async listChats(): Promise<TelegramChat[]> {
    return this.chats.listChats();
  }

  async readMessages(chatId: string, afterId: number, limit: number): Promise<TelegramMessage[]> {
    return this.chats.readMessages(chatId, afterId, limit);
  }

  onIncoming(heard: (message: IncomingMessage) => void): void {
    this.chats.onIncoming(heard);
  }

  async close(): Promise<void> {
    if (this.released) return;
    this.released = true;
    await this.letGo();
  }
}
