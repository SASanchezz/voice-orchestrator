import type { SessionHandoff } from "../../workers/session-handoff.js";
import type { ActionReporter } from "./action-reporter.js";
import type { UiLookup } from "./ui-lookup.js";

/** Handing a session whose context got large over to a fresh one, by click. */
export class HandoffActions {
  constructor(
    private handoff: SessionHandoff,
    private lookup: UiLookup,
    private reporter: ActionReporter,
  ) {}

  async handOff(sessionId: string): Promise<string> {
    this.lookup.requireSession(sessionId);
    const session = this.lookup.session(sessionId);
    return this.reporter.report(session.project, await this.handoff.handOff(session));
  }
}
