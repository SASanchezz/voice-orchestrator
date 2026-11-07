import { ALL_CHATS, type TelegramSettings } from "../../config/messages-config.js";
import { isNamed } from "../chat-names.js";
import type { SourceCursor } from "../cursors.js";
import type { TelegramChat } from "./telegram-port.js";

/** Telegram's own service account, where login codes arrive: never read, whatever the config says. */
export const TELEGRAM_SERVICE_ACCOUNT = "777000";

/** The chats the config allows, and the config names matched to chat IDs so far. */
export interface ChatChoice {
  chats: TelegramChat[];
  namedChatIds: Record<string, string>;
}

/** Every chat but the service account and the excluded ones; with a list of names, only those. */
export function allowedChats(chats: TelegramChat[], settings: TelegramSettings, cursor: SourceCursor): ChatChoice {
  const open = chats.filter((chat) => chat.id !== TELEGRAM_SERVICE_ACCOUNT && !isExcluded(chat, settings.exclude));
  if (settings.chats === ALL_CHATS) return { chats: open, namedChatIds: cursor.namedChatIds };
  return chosenByName(open, settings.chats, cursor.namedChatIds);
}

/** A chat matched by name once is found by its ID after that, so renaming it doesn't drop it. */
function chosenByName(open: TelegramChat[], names: string[], remembered: Record<string, string>): ChatChoice {
  const matched: Record<string, string> = {};
  for (const name of names) {
    const chat = chatFor(open, name, remembered[name]);
    if (chat) matched[name] = chat.id;
  }
  const chosenIds = new Set(Object.values(matched));
  return { chats: open.filter((chat) => chosenIds.has(chat.id)), namedChatIds: { ...remembered, ...matched } };
}

function chatFor(open: TelegramChat[], name: string, rememberedId: string | undefined): TelegramChat | undefined {
  const remembered = open.find((candidate) => candidate.id === rememberedId);
  return remembered ?? open.find((candidate) => isNamed(candidate.name, name));
}

function isExcluded(chat: TelegramChat, exclude: string[]): boolean {
  return exclude.some((name) => isNamed(chat.name, name));
}

/** New since the cursor; a chat never read before counts as new when it has unread messages. */
export function hasNewMessages(chat: TelegramChat, cursor: SourceCursor): boolean {
  const lastRead = cursor.chats[chat.id];
  return lastRead ? chat.lastMessageId > Number(lastRead) : chat.unreadCount > 0;
}

/** Where reading starts: the cursor, or for a chat never read before, the last message you read in Telegram. */
export function readAfterId(chat: TelegramChat, cursor: SourceCursor): number {
  const lastRead = cursor.chats[chat.id];
  return lastRead ? Number(lastRead) : chat.readInboxMaxId;
}

/** Private chats first, then the rest; busiest first within each. */
export function busiestFirst(chats: TelegramChat[]): TelegramChat[] {
  return chats.toSorted((first, second) => rank(first) - rank(second) || second.unreadCount - first.unreadCount);
}

function rank(chat: TelegramChat): number {
  return chat.kind === "private" ? 0 : 1;
}
