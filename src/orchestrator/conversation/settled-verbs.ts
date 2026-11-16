import { EventEmitter } from "node:events";
import type { AppEvent, AppEvents } from "../../events/app-events.js";
import type { ConversationLine, ConversationLines } from "./conversation-lines.js";

/**
 * Confirm phrases nothing waits for any more: a worker's destructive request with that verb was answered since your
 * last words (by a click, say, while the assistant was still writing its reply about it), and no other request with
 * the verb still waits. Emits "settled" with the verb when that happens.
 */
export class SettledVerbs extends EventEmitter {
  /** The destructive verb of each waiting request that has one, by request id. */
  private waitingVerbs = new Map<string, string>();
  private answeredVerbs = new Set<string>();

  follow(events: AppEvents, lines: ConversationLines): void {
    events.on("event", (e: AppEvent) => this.noteRequest(e));
    events.on("permission_closed", (id: string) => this.noteAnswered(id));
    lines.on("line", (line: ConversationLine) => this.forgetOnYourWords(line));
  }

  isSettled(verb: string): boolean {
    const stillWaits = [...this.waitingVerbs.values()].includes(verb);
    return this.answeredVerbs.has(verb) && !stillWaits;
  }

  private noteRequest(e: AppEvent): void {
    if (e.kind === "permission" && e.destructiveVerb) this.waitingVerbs.set(e.id, e.destructiveVerb);
  }

  private noteAnswered(id: string): void {
    const verb = this.waitingVerbs.get(id);
    if (!verb) return;
    this.waitingVerbs.delete(id);
    this.answeredVerbs.add(verb);
    if (this.isSettled(verb)) this.emit("settled", verb);
  }

  private forgetOnYourWords(line: ConversationLine): void {
    if (line.role === "user") this.answeredVerbs.clear();
  }
}
