import type { AppConfig } from "../../config/app-config.js";
import type { Registry } from "../../registry/registry.js";
import type { StatusReport } from "../../registry/status-report.js";
import type { SessionControl } from "../../workers/session-control.js";
import { defineTool, needProject, projectArg, sessionNumberArg, text, type OperatorTool } from "./tool-kit.js";

export function listSessions(status: StatusReport, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "list_sessions",
    description: "A project's open sessions with their status; marks the active one.",
    args: { project: projectArg },
    run: ({ project }) => text(status.sessionList(needProject(cfg, project))),
  });
}

export function newSession(registry: Registry, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "new_session",
    description: "Open a fresh worker session in a project and make it the active one.",
    args: { project: projectArg },
    run: ({ project }) => {
      const session = registry.createSession(needProject(cfg, project));
      return text(`Opened ${session.project} session ${session.number}; it is now active.`);
    },
  });
}

export function switchSession(registry: Registry, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "switch_session",
    description: "Make another of a project's sessions the active one.",
    args: { project: projectArg, session: sessionNumberArg },
    run: ({ project, session: number }) => {
      const session = registry.sessionByNumber(needProject(cfg, project), number);
      registry.activate(session.id);
      return text(`${session.project} session ${session.number} is now active.`);
    },
  });
}

export function closeSession(registry: Registry, control: SessionControl, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "close_session",
    description: "Close a session for good: stops its worker and deletes its queue and history.",
    args: { project: projectArg, session: sessionNumberArg },
    run: async ({ project, session: number }) =>
      text(await control.closeSession(registry.sessionByNumber(needProject(cfg, project), number).id)),
  });
}
