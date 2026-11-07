import { EventEmitter } from "node:events";
import type { ConversationLine, ConversationLines } from "./conversation-lines.js";

/**
 * The confirm phrases the assistant has asked you to say, which the web UI and a native pop-up answer with
 * Confirm and Cancel buttons. Only the assistant's ask_to_confirm tool opens one, so a phrase merely quoted in a
 * reply shows no button. Your next words close it, whatever they are.
 * Emits "asked" with the verbs on each request, and "closed" when your words end an open one.
 */
export class ConfirmAsk extends EventEmitter {
  private asked: string[] = [];

  /** Replaces any earlier request: the assistant now waits for one of these, e.g. ["update", "delete"]. */
  ask(verbs: string[]): void {
    this.asked = [...new Set(verbs.map((verb) => verb.toLowerCase()))];
    this.emit("asked", this.asked);
  }

  /** The verbs still waiting for your answer; empty when nothing is asked. */
  get verbs(): string[] {
    return this.asked;
  }

  follow(lines: ConversationLines): void {
    lines.on("line", (line: ConversationLine) => this.closeOnYourWords(line));
  }

  private closeOnYourWords(line: ConversationLine): void {
    if (line.role !== "user" || !this.asked.length) return;
    this.asked = [];
    this.emit("closed");
  }
}
