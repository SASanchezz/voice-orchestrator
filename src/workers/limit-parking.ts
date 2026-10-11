import type { UsageLimitHit } from "../limits/usage-limit.js";
import type { UsageLimits } from "../limits/usage-limits.js";
import type { Sessions } from "../registry/sessions.js";
import type { RunningTask } from "./running-task.js";
import type { WorkerChat } from "./worker-chat.js";

/** A task that hit its account's usage limit is saved to todo with the session's queue, instead of being reported. */
export class LimitParking {
  constructor(
    private limits: UsageLimits,
    private sessions: Sessions,
    private chat: WorkerChat,
  ) {}

  park(task: RunningTask, hit: UsageLimitHit): void {
    const { queued } = this.sessions.session(task.sessionId);
    this.sessions.updateSession(task.sessionId, { queued: [] });
    const { project, sessionId: session, sessionNumber, account } = task;
    const limited = { project, session, label: this.sessions.labelOf(session), sessionNumber, account };
    this.limits.park(limited, [task.instruction, ...queued], hit);
    const alsoQueued = queued.length ? ` and ${queued.length} queued` : "";
    this.chat.sayFailure(session, `The ${account} account hit its usage limit; saved to todo: this task${alsoQueued}.`);
  }

  /** The account works again: its next limit failure is announced. */
  accountWorks(account: string): void {
    this.limits.endEpisode(account);
  }
}
