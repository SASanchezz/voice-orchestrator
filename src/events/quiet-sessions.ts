import { AppEvents, type AppEvent } from "./app-events.js";

/** The events besides "event" that whoever shows a pop-up follows, passed on unchanged. */
const PASSED_ON = [
  "permission_explained",
  "permission_closed",
  "question_closed",
  "session_removed",
  "session_cleared",
];

/**
 * Sessions that run without a sound or a pop-up, such as tasks resumed on their own after a usage limit reset at
 * night. They stay quiet until you are back: you talk or type to the assistant.
 * Their chats and the web UI still show everything.
 */
export class QuietSessions {
  private quiet = new Set<string>();

  keepQuiet(sessionId: string): void {
    this.quiet.add(sessionId);
  }

  isQuiet(sessionId: string): boolean {
    return this.quiet.has(sessionId);
  }

  covers(event: AppEvent): boolean {
    return this.isQuiet(event.session);
  }

  /** You are back: every session speaks and pops up again. */
  wake(): void {
    this.quiet.clear();
  }

  /** The same events, less those of quiet sessions, for whoever makes a sound or shows a pop-up. */
  audible(events: AppEvents): AppEvents {
    const audible = new AppEvents();
    events.on("event", (e: AppEvent) => {
      if (!this.covers(e)) audible.emitEvent(e);
    });
    for (const name of PASSED_ON) events.on(name, (...args: unknown[]) => audible.emit(name, ...args));
    return audible;
  }
}
