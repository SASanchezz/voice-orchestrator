import type { SessionControl } from "../../workers/session-control.js";
import type { ActionReporter } from "./action-reporter.js";
import type { UiLookup } from "./ui-lookup.js";

/** Stopping, closing and clearing a session by click. */
export class SessionActions {
  constructor(
    private control: SessionControl,
    private lookup: UiLookup,
    private reporter: ActionReporter,
  ) {}

  stopTask(sessionId: string): string {
    this.lookup.requireSession(sessionId);
    const about = this.lookup.labelOf(sessionId);
    return this.reporter.report(about, this.control.stopSession(sessionId));
  }

  async closeSession(sessionId: string): Promise<string> {
    this.lookup.requireSession(sessionId);
    const { project } = this.lookup.session(sessionId);
    return this.reporter.report(project, await this.control.closeSession(sessionId));
  }

  async clearSession(sessionId: string): Promise<string> {
    this.lookup.requireSession(sessionId);
    const { project } = this.lookup.session(sessionId);
    return this.reporter.report(project, await this.control.clearSession(sessionId));
  }
}
