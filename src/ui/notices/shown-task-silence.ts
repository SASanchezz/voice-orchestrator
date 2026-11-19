import type { AppEvent, AppEvents } from "../../events/app-events.js";
import type { ShownSessions } from "./shown-sessions.js";

/** Keeps what would be said about an event from being said, without stopping what is playing now. */
export interface SilenceableVoices {
  keepSilent(event: AppEvent): void;
}

/**
 * A task that ends in the session a web UI page has on screen while you use it is not said aloud: you saw it end.
 * Its chat shows the result, and the assistant still reads of it with your next message.
 */
export class ShownTaskSilence {
  constructor(
    private shownSessions: ShownSessions,
    private voices: SilenceableVoices,
  ) {}

  follow(events: AppEvents): void {
    events.on("event", (e: AppEvent) => {
      if (this.endedOnScreen(e)) this.voices.keepSilent(e);
    });
  }

  private endedOnScreen(e: AppEvent): boolean {
    const isTaskEnd = e.kind === "task_done" || e.kind === "task_failed";
    return isTaskEnd && this.shownSessions.isShown(e.session);
  }
}
