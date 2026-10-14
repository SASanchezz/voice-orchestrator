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
import type { DestructiveList } from "../safety/destructive-list.js";

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
  attachments: AttachmentFiles;
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
    attachments: new AttachmentFiles(resolve(STATE_DIR, "attachments")),
  };
}
