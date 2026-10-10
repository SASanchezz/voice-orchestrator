import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { STATE_DIR } from "./config.js";
import type { AppEvent, Registry } from "./registry.js";
import type { WorkerManager } from "./workers.js";

const MAX_MESSAGES_PER_SESSION = 200;
const MAX_MESSAGE_CHARS = 8000;

/** task: an instruction sent to the worker; reply: what the worker wrote; tool: a step it took. */
export type ChatKind = "task" | "reply" | "tool" | "status" | "permission";

/** A line a worker session adds to its own chat. */
export interface SessionMessage {
  session: string;
  kind: ChatKind;
  text: string;
  failed?: boolean;
}

export interface ChatMessage {
  id: number;
  at: string;
  kind: ChatKind;
  text: string;
  failed?: boolean;
}

/**
 * Each worker session's own message history, like one chat tab in VS Code.
 * Kept per session in state/chats/, so it survives restarts; deleted when the session is closed or cleared.
 */
export class SessionChats extends EventEmitter {
  private chats = new Map<string, ChatMessage[]>();

  follow(workers: WorkerManager, registry: Registry) {
    workers.on("message", (m: SessionMessage) => this.add(m));
    registry.on("event", (e: AppEvent) => {
      if (e.kind === "permission" && !e.reminder) this.add({ session: e.session, kind: "permission", text: `asks: ${e.description}` });
    });
    registry.on("session_removed", (sessionId: string) => this.remove(sessionId));
    registry.on("session_cleared", (sessionId: string) => this.clear(sessionId));
  }

  messagesOf(sessionId: string): ChatMessage[] {
    const cached = this.chats.get(sessionId);
    if (cached) return cached;
    const file = this.fileOf(sessionId);
    const loaded: ChatMessage[] = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
    this.chats.set(sessionId, loaded);
    return loaded;
  }

  private add({ session, ...line }: SessionMessage) {
    const history = this.messagesOf(session);
    const message: ChatMessage = {
      ...line,
      text: line.text.slice(0, MAX_MESSAGE_CHARS),
      id: (history.at(-1)?.id ?? 0) + 1,
      at: new Date().toISOString(),
    };
    const next = [...history, message].slice(-MAX_MESSAGES_PER_SESSION);
    this.chats.set(session, next);
    mkdirSync(this.dir(), { recursive: true });
    writeFileSync(this.fileOf(session), JSON.stringify(next));
    this.emit("message", { session, message });
  }

  private remove(sessionId: string) {
    this.chats.delete(sessionId);
    rmSync(this.fileOf(sessionId), { force: true });
  }

  /** Empties a session's chat that stays open; listeners get "cleared" with its id. */
  private clear(sessionId: string) {
    this.remove(sessionId);
    this.emit("cleared", sessionId);
  }

  private dir(): string {
    return resolve(STATE_DIR, "chats");
  }

  private fileOf(sessionId: string): string {
    return resolve(this.dir(), `${sessionId}.json`);
  }
}
