import { EventEmitter } from "node:events";
import type { ConversationLine, ConversationLines } from "./conversation-lines.js";

/**
 * What the assistant is waiting for you to answer by click as well as by voice: confirm phrases, which the web UI
 * and a native pop-up answer with Confirm and Cancel buttons, or a go-ahead, which the web UI answers with Yes and
 * Cancel. Only the assistant's ask_to_confirm and ask_go_ahead tools open one, so a phrase merely quoted in a reply
 * shows no button. A new request replaces the old one; your next words close it, whatever they are.
 * Emits "asked" with the verbs on each confirm request, and "closed" when a confirm request ends.
 */
export class ConfirmAsk extends EventEmitter {
  private asked: string[] = [];
  private goAhead = false;

  /** Replaces any earlier request: the assistant now waits for one of these, e.g. ["update", "delete"]. */
  ask(verbs: string[]): void {
    this.goAhead = false;
    this.asked = [...new Set(verbs.map((verb) => verb.toLowerCase()))];
    this.emit("asked", this.asked);
  }

  /** Replaces any earlier request: the assistant now waits for a yes or a cancel before it starts. */
  askGoAhead(): void {
    this.closeVerbs();
    this.goAhead = true;
  }

  /** The verbs still waiting for your answer; empty when nothing is asked. */
  get verbs(): string[] {
    return this.asked;
  }

  /** Whether a go-ahead question still waits for your answer. */
  get goAheadAsked(): boolean {
    return this.goAhead;
  }

  follow(lines: ConversationLines): void {
    lines.on("line", (line: ConversationLine) => this.closeOnYourWords(line));
  }

  private closeOnYourWords(line: ConversationLine): void {
    if (line.role !== "user") return;
    this.goAhead = false;
    this.closeVerbs();
  }

  private closeVerbs(): void {
    if (!this.asked.length) return;
    this.asked = [];
    this.emit("closed");
  }
}
