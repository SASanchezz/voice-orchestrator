import type { TelegramSettings } from "../../config/messages-config.js";
import { findNamed } from "../chat-names.js";
import type { SourceCursor } from "../cursors.js";
import type { ChatReading, MessageSource, SourceReading } from "../message-types.js";
import { capNotes, readWithinCaps, type CappedReads, type ChatRead } from "./telegram-caps.js";
import { allowedChats, busiestFirst, hasNewMessages, readAfterId, type ChatChoice } from "./telegram-chat-choice.js";
import type { OpenTelegram, TelegramChat, TelegramChats } from "./telegram-port.js";
import { withShortWaits, type Wait } from "./telegram-waits.js";

/** Asking about one chat by name reads this many of its new messages. */
export const FULL_CHAT_MESSAGES = 200;

/** Your Telegram account as a user client: the chats the config allows, busiest private chats first. */
export class TelegramSource implements MessageSource {
  readonly kind = "telegram";
  readonly name = "Telegram";
  readonly cursorKey = "telegram";
  readonly profile: string;

  constructor(
    private settings: TelegramSettings,
    private open: OpenTelegram,
    private wait: Wait,
  ) {
    this.profile = settings.profile;
  }

  describe(): string {
    const { chats, exclude, profile } = this.settings;
    const which = typeof chats === "string" ? "all chats" : `chats ${chats.join(", ") || "(none)"}`;
    const skipped = exclude.length ? `, except ${exclude.join(", ")}` : "";
    return `Telegram: ${which}${skipped}; summarized on the ${profile} account`;
  }

  async read(cursor: SourceCursor, chat?: string): Promise<SourceReading> {
    const telegram = await this.open();
    try {
      return await this.readFrom(telegram, cursor, chat);
    } finally {
      await telegram.close();
    }
  }

  private async readFrom(telegram: TelegramChats, cursor: SourceCursor, chat?: string): Promise<SourceReading> {
    const listed = await withShortWaits(this.wait, async () => telegram.listChats());
    const choice = allowedChats(listed, this.settings, cursor);
    const readChat = async (found: TelegramChat, limit: number) =>
      withShortWaits(this.wait, async () => telegram.readMessages(found.id, readAfterId(found, cursor), limit));
    const capped = chat
      ? await readWithinCaps([chatNamed(choice, chat)], readChat, FULL_CHAT_MESSAGES)
      : await readWithinCaps(busiestFirst(choice.chats.filter((found) => hasNewMessages(found, cursor))), readChat);
    return readingOf(capped, cursor, choice);
  }
}

function chatNamed(choice: ChatChoice, spoken: string): TelegramChat {
  const found = findNamed(choice.chats, spoken, (chat) => chat.name);
  if (!found) throw new Error(`no chat like "${spoken}" among the chats the config allows`);
  return found;
}

/** Each chat read moves its cursor to its newest message; the chats left over keep theirs. */
function readingOf(capped: CappedReads, cursor: SourceCursor, choice: ChatChoice): SourceReading {
  const movedIds = Object.fromEntries(capped.reads.map(({ chat }) => [chat.id, String(chat.lastMessageId)]));
  const chats = capped.reads.filter((read) => read.messages.length).map(chatReading);
  const next = { ...cursor, chats: { ...cursor.chats, ...movedIds }, namedChatIds: choice.namedChatIds };
  return { chats, notes: capNotes(capped), next };
}

function chatReading({ chat, messages }: ChatRead): ChatReading {
  return {
    chat: chat.name,
    messages: messages.map(({ from, sentAt, text, hasMedia }) => ({ from, sentAt, text, hasMedia })),
  };
}
