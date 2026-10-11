import { EventEmitter } from "node:events";
import type { ContextReset } from "./context-reset.js";
import type { ResetRequests } from "./reset-requests.js";
import type { ResetSchedule } from "./reset-schedule.js";

/**
 * Resets the model's context when asked or when due, once nothing is waiting, and restarts the app when asked.
 * Emits "restart": the app shuts down and is started again by the supervisor (see main.ts).
 */
export class SessionLifecycle extends EventEmitter {
  constructor(
    private requests: ResetRequests,
    private schedule: ResetSchedule,
    private context: ContextReset,
  ) {
    super();
  }

  /** On request, or hourly when idle. */
  async maybeReset(): Promise<void> {
    const requested = this.requests.requestedReset;
    if (requested) return this.context.reset(requested);
    if (this.schedule.isDue()) await this.context.reset("notes");
  }

  restartRequested(): boolean {
    return this.requests.restartRequested;
  }

  restart(): void {
    this.requests.clearRestart();
    this.emit("restart");
  }
}
