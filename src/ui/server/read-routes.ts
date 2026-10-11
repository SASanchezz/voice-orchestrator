import type { ServerResponse } from "node:http";
import type { SessionChats } from "../session-chats.js";
import { HTTP_STATUS } from "./http-error.js";
import type { StatePublisher } from "./state-publisher.js";
import type { UiAccess } from "./ui-access.js";
import type { UiLookup } from "./ui-lookup.js";

/** What a page reads: the live event stream, and a session's chat when you open it. */
export class ReadRoutes {
  constructor(
    private access: UiAccess,
    private publisher: StatePublisher,
    private chats: SessionChatReader,
  ) {}

  events(url: URL, res: ServerResponse): void {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    this.publisher.welcome(res);
  }

  sessionMessages(url: URL, sessionId: string, res: ServerResponse): void {
    this.access.requireToken(url.searchParams.get("token"), "Bad token");
    const messages = this.chats.messagesOf(sessionId);
    res.writeHead(HTTP_STATUS.ok, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(messages));
  }
}

/** A known session's chat. */
export class SessionChatReader {
  constructor(
    private lookup: UiLookup,
    private chats: SessionChats,
  ) {}

  messagesOf(sessionId: string): ReturnType<SessionChats["messagesOf"]> {
    this.lookup.requireSession(sessionId);
    return this.chats.messagesOf(sessionId);
  }
}
