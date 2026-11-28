import type { SessionCompaction } from "../../workers/session-compaction.js";
import type { ActionReporter } from "./action-reporter.js";
import type { UiLookup } from "./ui-lookup.js";

/** Compacting a session's context in place, by click. */
export class CompactionActions {
  constructor(
    private compaction: SessionCompaction,
    private lookup: UiLookup,
    private reporter: ActionReporter,
  ) {}

  async compact(sessionId: string): Promise<string> {
    this.lookup.requireSession(sessionId);
    const session = this.lookup.session(sessionId);
    return this.reporter.report(session.project, await this.compaction.compact(session));
  }
}
