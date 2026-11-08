import { resolve } from "node:path";
import { AttachmentFiles } from "../attachments/attachment-files.js";
import type { AppConfig } from "../config/app-config.js";
import { STATE_DIR } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import type { Projects } from "../registry/projects.js";
import type { Registry } from "../registry/registry.js";
import type { Sessions } from "../registry/sessions.js";
import { StatusReport } from "../registry/status-report.js";
import { TaskHistory } from "../registry/task-history.js";
import { BranchScopedRules } from "../permissions/branch-scoped-rules.js";
import { BranchProtection } from "../safety/branch-protection.js";
import type { DestructiveList } from "../safety/destructive-list.js";
import { GitBranches } from "../safety/git-branches.js";
import { messengerLinks, type MessengerLinks } from "./build-messages.js";

/** What every part of the app builds on: config, events, projects and sessions, the destructive rules and attached files. */
export interface Core {
  cfg: AppConfig;
  events: AppEvents;
  projects: Projects;
  sessions: Sessions;
  registry: Registry;
  history: TaskHistory;
  status: StatusReport;
  destructive: DestructiveList;
  /** The destructive rules as they apply to workers, where some depend on the branch a command runs on. */
  workerRules: BranchScopedRules;
  attachments: AttachmentFiles;
  /** How Slack and Telegram are opened, so the whole app shares one Telegram connection. */
  messengers: MessengerLinks;
}

export function buildCore(cfg: AppConfig, destructive: DestructiveList): Core {
  const events = new AppEvents();
  const projectProfiles = Object.fromEntries(Object.entries(cfg.projects).map(([name, p]) => [name, p.profile]));
  const { projects, sessions, registry } = openRegistry(projectProfiles, events);
  const history = new TaskHistory(projects, sessions);
  return {
    cfg,
    events,
    projects,
    sessions,
    registry,
    history,
    status: new StatusReport(projects, sessions),
    destructive,
    workerRules: workerRules(cfg, destructive),
    attachments: new AttachmentFiles(resolve(STATE_DIR, "attachments")),
    messengers: messengerLinks(),
  };
}

function workerRules(cfg: AppConfig, destructive: DestructiveList): BranchScopedRules {
  const protection = new BranchProtection(cfg.permissions.protectedBranches, new GitBranches());
  return new BranchScopedRules(destructive, protection);
}
