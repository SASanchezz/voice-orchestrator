import { Inbox } from "./inbox.js";
import type { SessionStream } from "./session-stream.js";
import type { TurnReplies } from "./turn-replies.js";

const SECOND_MS = 1000;

/** The orchestrator's long-lived model session: started, asked turn by turn, restarted after a crash or a reset. */
export class OperatorSession {
  private inbox = new Inbox();
  private startedAt = 0;

  constructor(
    private stream: SessionStream,
    private replies: TurnReplies,
  ) {}

  start(): void {
    this.inbox = new Inbox();
    this.run(this.inbox);
  }

  /** Resolves with the turn's whole reply; `onText` hears each piece as the model writes it, before its tool calls run. */
  ask(content: string, onText?: (text: string) => void): Promise<string> {
    const reply = this.replies.expect(onText);
    this.inbox.push(content);
    return reply;
  }

  close(): void {
    this.inbox.close();
  }

  ageMs(): number {
    return Date.now() - this.startedAt;
  }

  private run(inbox: Inbox): void {
    this.startedAt = Date.now();
    this.stream.follow(inbox, () => this.restartAfterCrash(inbox));
  }

  /** The new inbox is swapped in right away: messages sent during the wait queue there for the new session. */
  private restartAfterCrash(crashed: Inbox): void {
    if (crashed !== this.inbox) return; // a context reset already started a new session
    const delay = this.stream.nextRestartDelay();
    const next = new Inbox();
    this.inbox = next;
    console.error(`[orchestrator] restarting in ${delay / SECOND_MS}s`);
    setTimeout(() => {
      if (next === this.inbox) this.run(next);
    }, delay);
  }
}
