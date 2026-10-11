import type { Projects } from "../../registry/projects.js";
import type { Sessions } from "../../registry/sessions.js";

/** Which Claude account each project's workers use. */
export class ProjectAccounts {
  constructor(
    private projects: Projects,
    private sessions: Sessions,
  ) {}

  accountOf(project: string): string {
    return this.projects.get(project).profile;
  }

  /** Sessions live inside a config dir, so a switch can't resume the old ones: each starts a fresh conversation. */
  switchTo(project: string, profile: string): void {
    this.projects.update(project, { profile });
    for (const session of this.sessions.sessionsOf(project))
      this.sessions.updateSession(session.id, { claudeSessionId: undefined });
  }
}
