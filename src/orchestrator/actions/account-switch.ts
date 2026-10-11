import type { AppConfig } from "../../config/app-config.js";
import { saveProject } from "../../config/project-overlay.js";
import type { SessionControl } from "../../workers/session-control.js";
import type { ProjectAccounts } from "./project-accounts.js";

/** Moves an idle project to another account, in the running app and for the next start. */
export class AccountSwitch {
  constructor(
    private cfg: AppConfig,
    private control: SessionControl,
    private accounts: ProjectAccounts,
  ) {}

  accountOf(project: string): string {
    return this.accounts.accountOf(project);
  }

  switch(project: string, profile: string): string {
    if (!this.cfg.profiles[profile]) throw new Error(`Unknown account ${profile}`);
    if (this.control.isBusy(project)) throw new Error(`${project} is busy; stop it first`);
    this.accounts.switchTo(project, profile);
    saveProject(this.cfg, project, { ...this.cfg.projects[project], profile });
    return `${project} will use the ${profile} account from its next task, in a fresh session.`;
  }
}
