import { isNamed } from "../chat-names.js";
import type { Arrival } from "./arrivals.js";

/** What is said about a batch of arrivals, and what the assistant is told. Neither holds any message text. */
export interface AlertLines {
  spoken: string;
  note: string;
}

interface ChatArrivals {
  source: string;
  chat: string;
  senders: string[];
}

/** "Telegram: a new message from Bob, 3 new messages in Family. Slack acme: …", in the order they arrived. */
export function alertLinesOf(arrivals: Arrival[]): AlertLines {
  const chats = byChat(arrivals);
  const sources = new Set(chats.map((chat) => chat.source));
  const spoken = [...sources].map((source) => sourceSentence(source, chats)).join(" ");
  return { spoken, note: `[NOTICE] New messages arrived (announced only, not read): ${spoken}` };
}

function sourceSentence(source: string, chats: ChatArrivals[]): string {
  const lines = chats.filter((chat) => chat.source === source).map(chatLine);
  return `${source}: ${lines.join(", ")}.`;
}

function byChat(arrivals: Arrival[]): ChatArrivals[] {
  const chats = new Map<string, ChatArrivals>();
  for (const { source, chat, from } of arrivals) {
    const key = JSON.stringify([source, chat]);
    const known = chats.get(key) ?? { source, chat, senders: [] };
    known.senders.push(from);
    chats.set(key, known);
  }
  return [...chats.values()];
}

function chatLine({ chat, senders }: ChatArrivals): string {
  const count = senders.length;
  if (isDirectChat(chat, senders))
    return count === 1 ? `a new message from ${chat}` : `${count} new messages from ${chat}`;
  return count === 1 ? `a new message from ${senders[0]} in ${chat}` : `${count} new messages in ${chat}`;
}

/** A private chat or DM is named after the person in it, so everything in it comes from that person. */
function isDirectChat(chat: string, senders: string[]): boolean {
  return senders.every((sender) => isNamed(sender, chat));
}
