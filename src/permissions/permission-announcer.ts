import type { AppConfig } from "../config/app-config.js";
import type { AppEvents, PermissionEvent } from "../events/app-events.js";
import type { Sessions } from "../registry/sessions.js";
import type { Pending } from "./permission-types.js";

const MINUTE_MS = 60_000;

/** Tells everyone listening that a worker waits for your answer, and again every few minutes while it still waits. */
export class PermissionAnnouncer {
  constructor(
    private sessions: Sessions,
    private events: AppEvents,
    private settings: AppConfig["permissions"],
  ) {}

  announce(pending: Pending): void {
    this.events.emitEvent({ ...this.eventFor(pending), reminder: false });
  }

  /** Reminds every reminderMinutes of the request `waiting` returns, until it returns none; clear the timer once answered. */
  remindEvery(waiting: () => Pending | undefined): NodeJS.Timeout {
    return setInterval(() => {
      const pending = waiting();
      if (pending) this.events.emitEvent({ ...this.eventFor(pending), reminder: true });
    }, this.settings.reminderMinutes * MINUTE_MS);
  }

  /** Its plain-language explanation is ready, for whoever shows the request. */
  explained(pending: Pending): void {
    if (pending.explanation) this.events.emitPermissionExplained(pending.id, pending.explanation);
  }

  /** It no longer waits: whoever shows or says it can stop. */
  withdraw(requestId: string): void {
    this.events.emitPermissionClosed(requestId);
  }

  private eventFor(pending: Pending): PermissionEvent {
    return {
      kind: "permission",
      id: pending.id,
      project: pending.project,
      session: pending.session,
      label: this.sessions.labelOf(pending.session),
      description: pending.description,
      destructiveVerb: pending.destructive?.verb,
    };
  }
}
