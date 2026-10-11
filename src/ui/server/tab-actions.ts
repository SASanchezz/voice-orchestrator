import type { Registry } from "../../registry/registry.js";
import type { ActionReporter } from "./action-reporter.js";
import type { UiLookup } from "./ui-lookup.js";

/** The session tabs: opening a new session and switching to another. */
export class TabActions {
  constructor(
    private registry: Registry,
    private lookup: UiLookup,
    private reporter: ActionReporter,
  ) {}

  createSession(project: string): string {
    this.lookup.requireProject(project);
    const session = this.registry.createSession(project);
    return this.reporter.report(project, `Opened ${project} session ${session.number}; it is now active.`);
  }

  activateSession(sessionId: string): string {
    this.lookup.requireSession(sessionId);
    this.registry.activate(sessionId);
    const { project, number } = this.lookup.session(sessionId);
    return this.reporter.report(project, `${project} session ${number} is now active.`);
  }
}
