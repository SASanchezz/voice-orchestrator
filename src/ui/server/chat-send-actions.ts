import { z } from "zod";
import type { ChatBrowsers } from "../../messages/browse/chat-browsers.js";

/** Telegram's longest message; Slack takes more. */
const MAX_MESSAGE_CHARS = 4096;
const chatMessageBody = z.object({ text: z.string().trim().min(1).max(MAX_MESSAGE_CHARS) });

/** A message you typed in All chats and sent with its Send button; nothing else writes there. */
export class ChatSendActions {
  constructor(private browsers: ChatBrowsers) {}

  async send(source: string, chatId: string, body: unknown): Promise<string> {
    const { text } = chatMessageBody.parse(body);
    const browser = this.browsers.browserOf(source);
    await browser.send(chatId, text);
    return `Sent to ${browser.label}.`;
  }
}
