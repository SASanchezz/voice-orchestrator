import type { InputQueue } from "./input-queue.js";

/** What the model should know besides your message: clicks since its last turn, your exact words, what else waits. */
export class TurnContext {
  /** Things you did in the UI since the model's last turn; prepended to its next message. */
  private uiNotes: string[] = [];
  /** Transcript of the utterance currently being handled; undefined during event turns. */
  private utterance?: string;

  constructor(private queue: InputQueue) {}

  addUiNote(note: string): void {
    this.uiNotes.push(note);
  }

  takeUiNotes(): string[] {
    return this.uiNotes.splice(0);
  }

  /** The words permission and destructive checks see; set by the runtime, never by the model. */
  get currentUtterance(): string | undefined {
    return this.utterance;
  }

  beginTurn(utterance: string | undefined): void {
    this.utterance = utterance;
  }

  endTurn(): void {
    this.utterance = undefined;
  }

  /** " (2 more waiting)" when more notifications are queued. */
  waitingNote(): string {
    const waiting = this.queue.waitingNotifications();
    return waiting ? ` (${waiting} more waiting)` : "";
  }

  /** For tests: set the transcript that permission/destructive checks see. */
  withUtterance<T>(utterance: string | undefined, run: () => Promise<T>): Promise<T> {
    this.utterance = utterance;
    return run().finally(() => (this.utterance = undefined));
  }
}
