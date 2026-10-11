import type { AppConfig } from "../config/app-config.js";
import type { Projects } from "../registry/projects.js";
import type { SessionState } from "../registry/registry-schema.js";
import type { Sessions } from "../registry/sessions.js";
import type { RunningTask } from "./running-task.js";

/** What workers need to know about projects and their sessions: folders, accounts, names and conversations. */
export class WorkerDirectory {
  constructor(
    private cfg: AppConfig,
    private projects: Projects,
    private sessions: Sessions,
  ) {}

  isKnown(project: string): boolean {
    return Boolean(this.cfg.projects[project]);
  }

  folderOf(project: string): string {
    return this.cfg.projects[project].path;
  }

  modelOf(project: string): string | undefined {
    return this.cfg.projects[project].model;
  }

  accountOf(project: string): string {
    return this.projects.get(project).profile;
  }

  activeSession(project: string): SessionState {
    return this.sessions.session(this.projects.get(project).activeSession);
  }

  projectOf(sessionId: string): string {
    return this.sessions.session(sessionId).project;
  }

  sessionIdsOf(project: string): string[] {
    return this.sessions.sessionsOf(project).map((s) => s.id);
  }

  labelOf(sessionId: string): string {
    return this.sessions.labelOf(sessionId);
  }

  newTask(sessionId: string, instruction: string): RunningTask {
    const { project, number: sessionNumber, claudeSessionId: resume } = this.sessions.session(sessionId);
    return { sessionId, project, sessionNumber, instruction, account: this.accountOf(project), resume };
  }
}
