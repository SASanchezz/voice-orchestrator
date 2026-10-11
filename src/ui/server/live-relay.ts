import type { Feed } from "../feed.js";
import type { FeedEntry } from "../feed-entry.js";
import type { ServerEvents } from "../protocol.js";
import type { SessionChats } from "../session-chats.js";
import type { LiveClients } from "./live-clients.js";

/** New lines in the assistant's chat and in session chats go straight to every open page. */
export function relayToClients(clients: LiveClients, feed: Feed, chats: SessionChats): void {
  feed.on("entry", (entry: FeedEntry) => clients.broadcast("feed", entry));
  feed.on("cleared", () => clients.broadcast("backlog", []));
  chats.on("message", (line: ServerEvents["chat"]) => clients.broadcast("chat", line));
  chats.on("cleared", (sessionId: string) => clients.broadcast("chat_cleared", sessionId));
}
