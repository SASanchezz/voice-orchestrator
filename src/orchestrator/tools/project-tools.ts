import { z } from "zod";
import type { AppConfig } from "../../config/app-config.js";
import type { StatusReport } from "../../registry/status-report.js";
import type { TaskHistory } from "../../registry/task-history.js";
import type { AccountSwitch } from "../actions/account-switch.js";
import type { ProjectOpener } from "../actions/project-opener.js";
import { accountArg, defineTool, needProject, projectArg, text, type OperatorTool } from "./tool-kit.js";

export function listProjects(status: StatusReport): OperatorTool {
  return defineTool({
    name: "list_projects",
    description: "All projects with status, account and current activity.",
    args: {},
    run: () => text(status.snapshot() || "No projects yet."),
  });
}

export function openProject(opener: ProjectOpener, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "open_project",
    description: "Find a folder by spoken name (or exact path) and register it as a project on the given account.",
    args: {
      name: z.string().describe("Spoken name, e.g. 'database admin', or a path"),
      profile: accountArg(cfg).optional(),
    },
    run: ({ name, profile }) => text(opener.open(name, profile)),
  });
}

export function projectStatus(status: StatusReport, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "project_status",
    description: "Detailed status of one project's active session.",
    args: { project: projectArg },
    run: ({ project }) => text(status.projectDetail(needProject(cfg, project))),
  });
}

export function projectHistory(history: TaskHistory, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "project_history",
    description:
      "A project's recent finished tasks with the worker's closing notes, including ones from before a restart.",
    args: { project: projectArg },
    run: ({ project }) => text(history.historyOf(needProject(cfg, project))),
  });
}

export function setProjectAccount(accounts: AccountSwitch, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "set_project_account",
    description: "Switch which Claude account a project's workers use (each session starts a fresh conversation).",
    args: { project: projectArg, profile: accountArg(cfg) },
    run: ({ project, profile }) => text(accounts.switch(needProject(cfg, project), profile)),
  });
}
