import type { SessionControl } from "../../workers/session-control.js";
import { closeAllReport, closingIds, planCloseAll, planCloseOthers, sweepReport } from "../session-sweep.js";
import type { ActionReporter } from "./action-reporter.js";
import type { UiLookup } from "./ui-lookup.js";

/** A session tab's menu: closing the project's other sessions, or all of them, leaving the running ones open. */
export class SessionSweepActions {
  constructor(
    private control: SessionControl,
    private lookup: UiLookup,
    private reporter: ActionReporter,
  ) {}

  async closeOthers(keptId: string): Promise<string> {
    this.lookup.requireSession(keptId);
    const { project } = this.lookup.session(keptId);
    const sweep = planCloseOthers(this.lookup.sessionsOf(project), keptId);
    await this.control.closeOthers(keptId, closingIds(sweep));
    return this.reporter.report(project, sweepReport(project, sweep));
  }

  async closeAll(project: string): Promise<string> {
    this.lookup.requireProject(project);
    const sweep = planCloseAll(this.lookup.sessionsOf(project));
    await this.control.closeSessions(closingIds(sweep));
    return this.reporter.report(project, closeAllReport(project, sweep));
  }
}
