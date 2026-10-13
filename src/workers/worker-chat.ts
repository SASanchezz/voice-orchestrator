import { EventEmitter } from "node:events";

/** task: an instruction sent to the worker; reply: what the worker wrote; tool: a step it took; question: it asked you. */
export type ChatKind = "task" | "reply" | "tool" | "status" | "permission" | "question";

/** A line a worker session adds to its own chat. */
export interface SessionMessage {
  session: string;
  kind: ChatKind;
  text: string;
  failed?: boolean;
}

/** The lines workers add to their sessions' chats. Emits "message" with each SessionMessage. */
export class WorkerChat extends EventEmitter {
  say(session: string, kind: ChatKind, text: string): void {
    const message: SessionMessage = { session, kind, text };
    this.emit("message", message);
  }

  sayFailure(session: string, text: string): void {
    const message: SessionMessage = { session, kind: "status", text, failed: true };
    this.emit("message", message);
  }
}
