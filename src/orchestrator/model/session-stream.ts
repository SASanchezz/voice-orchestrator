import type { Query } from "@anthropic-ai/claude-agent-sdk";
import type { QueryFn } from "../../agent/query-fn.js";
import { errorMessage } from "../../shared/errors.js";
import { CrashBackoff } from "./crash-backoff.js";
import type { Inbox } from "./inbox.js";
import type { OperatorOptions } from "./operator-options.js";
import type { TurnReplies } from "./turn-replies.js";

const CRASH_NOTICE = "Sorry, my control session crashed. Restarting it.";

/** Runs one model session on an inbox, passing its replies on, until it ends or crashes. */
export class SessionStream {
  private crashes = new CrashBackoff();

  constructor(
    private options: OperatorOptions,
    private query: QueryFn,
    private replies: TurnReplies,
  ) {}

  /** `onCrash` runs right after the turn in progress got the crash notice. */
  follow(inbox: Inbox, onCrash: () => void): void {
    void this.consume(this.query({ prompt: inbox, options: this.options.build() }), onCrash);
  }

  /** The wait before restarting after a crash; longer after each crash in a row. */
  nextRestartDelay(): number {
    return this.crashes.nextDelay();
  }

  private async consume(session: Query, onCrash: () => void): Promise<void> {
    try {
      for await (const msg of session) {
        if (msg.type === "result") this.crashes.reset();
        this.replies.receive(msg);
      }
    } catch (e) {
      console.error(`[orchestrator] session error: ${errorMessage(e)}`);
      this.replies.crashed(CRASH_NOTICE);
      onCrash();
    }
  }
}
