import type { BrowsedChatView, BrowsedMessageView, SourceChatsView } from "../../ui/chat-browse-views.js";

/** How many of a chat's latest messages the All chats view shows. */
export const SHOWN_MESSAGES = 50;

/**
 * One source's chats and messages. Nothing is marked read or stored by it; it writes only a message you typed and
 * sent yourself.
 */
export interface ChatBrowser {
  /** e.g. "Slack acme" or "Telegram". */
  readonly label: string;
  /** Why you can't write in its chats from the app; empty when you can. */
  readonly sendHint: string;
  listChats(): Promise<BrowsedChatView[]>;
  /** The chat's latest messages, oldest first. */
  readChat(chatId: string): Promise<BrowsedMessageView[]>;
  /** One file of a message, downloaded whole. */
  downloadFile(chatId: string, messageId: string, fileId: string): Promise<Buffer>;
  send(chatId: string, text: string): Promise<void>;
}

/**
 * Every configured source's browser, by source key. A source that fails to list says why instead of failing all. Each
 * chat's last reading is kept in memory, so a task is made from the messages you saw.
 */
export class ChatBrowsers {
  private readings = new Map<string, BrowsedMessageView[]>();

  constructor(private browsers: Map<string, ChatBrowser>) {}

  allChats(): Promise<SourceChatsView[]> {
    return Promise.all([...this.browsers].map(([source, browser]) => ChatBrowsers.chatsOf(source, browser)));
  }

  async readChat(source: string, chatId: string): Promise<BrowsedMessageView[]> {
    const messages = await this.browserOf(source).readChat(chatId);
    this.readings.set(ChatBrowsers.keyOf(source, chatId), messages);
    return messages;
  }

  /** The messages as last shown, read afresh when the chat wasn't opened since the app started. */
  async lastReading(source: string, chatId: string): Promise<BrowsedMessageView[]> {
    return this.readings.get(ChatBrowsers.keyOf(source, chatId)) ?? this.readChat(source, chatId);
  }

  browserOf(source: string): ChatBrowser {
    const browser = this.browsers.get(source);
    if (!browser) throw new Error(`No messenger called ${source} is set up.`);
    return browser;
  }

  private static async chatsOf(source: string, browser: ChatBrowser): Promise<SourceChatsView> {
    const { label, sendHint } = browser;
    const sending = { canSend: !sendHint, sendHint };
    try {
      return { source, label, chats: await browser.listChats(), problem: "", ...sending };
    } catch (error) {
      return { source, label, chats: [], problem: error instanceof Error ? error.message : String(error), ...sending };
    }
  }

  private static keyOf(source: string, chatId: string): string {
    return `${source}\n${chatId}`;
  }
}
