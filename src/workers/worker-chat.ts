import { EventEmitter } from "node:events";

/**
 * task: an instruction sent to the worker; reply: what the worker wrote; tool: a step it took; question: it asked you;
 * aside: its answer to a /btw side question, kept apart from its task's steps and reply.
 */
export type ChatKind = "task" | "reply" | "tool" | "status" | "permission" | "question" | "aside";

/** A line a worker session adds to its own chat. */
export interface SessionMessage {
  session: string;
  kind: ChatKind;
  text: string;
  failed?: boolean;
  /** A tool call's own id, so a sub-agent it started can point at it. */
  toolUseId?: string;
  /** Set on a sub-agent's lines: the tool call that started it. */
  parentToolUseId?: string;
  /** ISO time the line was first written, for lines brought back from a saved conversation; unset, now. */
  at?: string;
}

/** The lines workers add to their sessions' chats. Emits "message" with each SessionMessage. */
export class WorkerChat extends EventEmitter {
  say(session: string, kind: ChatKind, text: string): void {
    this.post({ session, kind, text });
  }

  /** A line with more to it than its text, such as a sub-agent's step. */
  post(message: SessionMessage): void {
    this.emit("message", message);
  }

  sayFailure(session: string, text: string): void {
    const message: SessionMessage = { session, kind: "status", text, failed: true };
    this.emit("message", message);
  }
}
