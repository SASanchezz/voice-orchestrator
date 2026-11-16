import { EventEmitter } from "node:events";
import type { ConversationLine, ConversationLines } from "./conversation-lines.js";

/**
 * What the assistant is waiting for you to answer by click as well as by voice: confirm phrases, which the web UI
 * and a native pop-up answer with Confirm and Cancel buttons, or a go-ahead, which the web UI answers with Yes and
 * Cancel. Only the assistant's ask_to_confirm and ask_go_ahead tools open one, so a phrase merely quoted in a reply
 * shows no button. A new request replaces the old one; your next words close it, whatever they are.
 * Emits "asked" with the verbs on each confirm request and with the rest when one is withdrawn, "goAheadAsked" on
 * each go-ahead question, and "closed" when either ends.
 */
export class ConfirmAsk extends EventEmitter {
  private asked: string[] = [];
  private goAhead = false;

  /** Replaces any earlier request: the assistant now waits for one of these, e.g. ["update", "delete"]. */
  ask(verbs: string[]): void {
    this.closeGoAhead();
    this.asked = [...new Set(verbs.map((verb) => verb.toLowerCase()))];
    this.emit("asked", this.asked);
  }

  /** Takes back a verb nothing waits for any more; the request closes once no verb is left. */
  withdraw(verb: string): void {
    if (!this.asked.includes(verb)) return;
    const rest = this.asked.filter((asked) => asked !== verb);
    if (!rest.length) return this.closeVerbs();
    this.asked = rest;
    this.emit("asked", rest);
  }

  /** Replaces any earlier request: the assistant now waits for a yes or a cancel before it starts. */
  askGoAhead(): void {
    this.closeVerbs();
    this.goAhead = true;
    this.emit("goAheadAsked");
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
    this.closeGoAhead();
    this.closeVerbs();
  }

  private closeGoAhead(): void {
    if (!this.goAhead) return;
    this.goAhead = false;
    this.emit("closed");
  }

  private closeVerbs(): void {
    if (!this.asked.length) return;
    this.asked = [];
    this.emit("closed");
  }
}
