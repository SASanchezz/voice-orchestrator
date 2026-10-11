import { EventEmitter } from "node:events";
import type { AppEvent, AppEvents } from "../events/app-events.js";
import type { SessionMessage, WorkerChat } from "../workers/worker-chat.js";
import type { ChatFiles, ChatMessage } from "./chat-files.js";

const MAX_MESSAGES_PER_SESSION = 200;
const MAX_MESSAGE_CHARS = 8000;

/**
 * Each worker session's own message history, like one chat tab in VS Code.
 * Kept per session in state/chats/, so it survives restarts; deleted when the session is closed or cleared.
 * Emits "message" with each new line, and "cleared" with the id of a session whose chat was emptied.
 */
export class SessionChats extends EventEmitter {
  private chats = new Map<string, ChatMessage[]>();

  constructor(private files: ChatFiles) {
    super();
  }

  follow(chat: WorkerChat, events: AppEvents): void {
    chat.on("message", (m: SessionMessage) => this.add(m));
    events.on("event", (e: AppEvent) => {
      if (e.kind === "permission" && !e.reminder)
        this.add({ session: e.session, kind: "permission", text: `asks: ${e.description}` });
    });
    events.on("session_removed", (sessionId: string) => this.remove(sessionId));
    events.on("session_cleared", (sessionId: string) => this.clear(sessionId));
  }

  messagesOf(sessionId: string): ChatMessage[] {
    const cached = this.chats.get(sessionId);
    if (cached) return cached;
    const loaded = this.files.read(sessionId);
    this.chats.set(sessionId, loaded);
    return loaded;
  }

  private add({ session, ...line }: SessionMessage): void {
    const history = this.messagesOf(session);
    const message = nextMessage(history, line);
    const next = [...history, message].slice(-MAX_MESSAGES_PER_SESSION);
    this.chats.set(session, next);
    this.files.write(session, next);
    this.emit("message", { session, message });
  }

  private remove(sessionId: string): void {
    this.chats.delete(sessionId);
    this.files.remove(sessionId);
  }

  private clear(sessionId: string): void {
    this.remove(sessionId);
    this.emit("cleared", sessionId);
  }
}

/** The line as the chat keeps it: numbered after the last one, timestamped, and cut to a sane length. */
function nextMessage(history: ChatMessage[], line: Omit<SessionMessage, "session">): ChatMessage {
  const id = (history.at(-1)?.id ?? 0) + 1;
  return { ...line, text: line.text.slice(0, MAX_MESSAGE_CHARS), id, at: new Date().toISOString() };
}
