import type { TelegramChat, TelegramMessage } from "./telegram-port.js";

/** "all" can mean hundreds of chats: each chat and the whole catch-up are capped. */
export const MAX_CHAT_MESSAGES = 30;
export const MAX_TOTAL_MESSAGES = 300;

type ReadChat = (chat: TelegramChat, limit: number) => Promise<TelegramMessage[]>;

export interface ChatRead {
  chat: TelegramChat;
  messages: TelegramMessage[];
  /** It hit its cap, so older new messages were skipped. */
  capped: boolean;
}

/** What was read in order until the total ran out, and the chats left for another time. */
export interface CappedReads {
  reads: ChatRead[];
  leftOver: TelegramChat[];
}

/** Reads the chats in the order given, each up to its cap, until the total is used up. */
export async function readWithinCaps(
  ordered: TelegramChat[],
  readChat: ReadChat,
  chatCap = MAX_CHAT_MESSAGES,
): Promise<CappedReads> {
  const reads: ChatRead[] = [];
  let room = MAX_TOTAL_MESSAGES;
  for (const [index, chat] of ordered.entries()) {
    if (room <= 0) return { reads, leftOver: ordered.slice(index) };
    const limit = Math.min(chatCap, room);
    const messages = await readChat(chat, limit);
    reads.push({ chat, messages, capped: messages.length === limit });
    room -= messages.length;
  }
  return { reads, leftOver: [] };
}

/** What didn't fit, to be spoken after the summary. */
export function capNotes({ reads, leftOver }: CappedReads): string[] {
  const capped = reads.filter((read) => read.capped).length;
  const notes = capped ? [`Only the latest messages were read in ${capped} busy chats.`] : [];
  return leftOver.length ? [...notes, leftOverNote(leftOver)] : notes;
}

function leftOverNote(leftOver: TelegramChat[]): string {
  const unread = leftOver.reduce((sum, chat) => sum + chat.unreadCount, 0);
  const messages = unread ? `${unread} unread messages` : "new messages";
  return `Plus ${leftOver.length} more chats with ${messages}; ask about a chat by name.`;
}
