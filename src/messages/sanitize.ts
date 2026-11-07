import { hideSecrets } from "./hidden-secrets.js";
import type { ChatReading, RawMessage } from "./message-types.js";

/** Each message is cut to this many characters, and a whole catch-up to MAX_BATCH_CHARS. */
export const MAX_MESSAGE_CHARS = 500;
export const MAX_BATCH_CHARS = 20_000;
const MAX_NAME_CHARS = 60;
export const MEDIA_LEFT_OUT = "[attachment not included]";
const CUT_MARK = "…";

/** Line breaks become spaces, so a message can't start a line of its own that looks like the prompt's. */
const LINE_BREAKS = /[\t\n\r\v\f\u2028\u2029]+/g;
/** Control and format characters (zero-width, bidi overrides, Unicode tags) and blank-looking letters. */
const INVISIBLE = /[\p{Cc}\p{Cf}\u115F\u1160\u2800\u3164\uFFA0]/gu;
const SPACES = / {2,}/g;
const LINK = /\bhttps?:\/\/[^\s<>|"]+/gi;

export interface QuotedMessage {
  from: string;
  sentAt: Date;
  text: string;
}

export interface QuotedChat {
  chat: string;
  messages: QuotedMessage[];
}

/** Cleaned chats ready to be quoted, and how many messages were left out to keep the total length. */
export interface QuotedBatch {
  chats: QuotedChat[];
  cutMessages: number;
}

/** Every message cleaned and cut, then the chats in order until the batch is full. */
export function quoteChats(chats: ChatReading[]): QuotedBatch {
  return fitBatch(chats.map(quoteChat));
}

/** One message's text as the summarizer may see it. */
export function cleanText(text: string): string {
  return cutTo(cleanLine(text), MAX_MESSAGE_CHARS);
}

/** A chat or sender name: cleaned like a message, and short. */
export function cleanName(name: string): string {
  return cutTo(cleanLine(name), MAX_NAME_CHARS);
}

function quoteChat({ chat, messages }: ChatReading): QuotedChat {
  return { chat: cleanName(chat), messages: messages.map(quoteMessage) };
}

function quoteMessage(message: RawMessage): QuotedMessage {
  const text = message.hasMedia ? `${message.text} ${MEDIA_LEFT_OUT}`.trim() : message.text;
  return { from: cleanName(message.from), sentAt: message.sentAt, text: cleanText(text) };
}

function cleanLine(text: string): string {
  const visible = text.replace(LINE_BREAKS, " ").replace(INVISIBLE, "");
  return hideSecrets(linksToDomains(visible)).replace(SPACES, " ").trim();
}

/** A link becomes its site's name, so paths and query strings (which may carry tokens) never reach the model. */
function linksToDomains(text: string): string {
  return text.replace(LINK, linkDomain);
}

function linkDomain(link: string): string {
  if (!URL.canParse(link)) return "[link]";
  return `[link: ${new URL(link).hostname}]`;
}

function cutTo(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - CUT_MARK.length)}${CUT_MARK}`;
}

/** Chats in order until the room runs out; the chat that overflows keeps the messages that fit. */
function fitBatch(chats: QuotedChat[]): QuotedBatch {
  const fitted: QuotedChat[] = [];
  let room = MAX_BATCH_CHARS;
  for (const chat of chats) {
    const kept = messagesWithin(chat.messages, room);
    room -= totalLength(kept);
    if (kept.length) fitted.push({ chat: chat.chat, messages: kept });
    if (kept.length < chat.messages.length) break;
  }
  return { chats: fitted, cutMessages: countOf(chats) - countOf(fitted) };
}

function messagesWithin(messages: QuotedMessage[], room: number): QuotedMessage[] {
  let used = 0;
  for (const [index, message] of messages.entries()) {
    used += messageLength(message);
    if (used > room) return messages.slice(0, index);
  }
  return messages;
}

function totalLength(messages: QuotedMessage[]): number {
  return messages.reduce((sum, message) => sum + messageLength(message), 0);
}

function messageLength(message: QuotedMessage): number {
  return message.from.length + message.text.length;
}

function countOf(chats: QuotedChat[]): number {
  return chats.reduce((sum, chat) => sum + chat.messages.length, 0);
}
