import type { AppConfig } from "../../config/app-config.js";
import type { Registry } from "../../registry/registry.js";
import type { StatusReport } from "../../registry/status-report.js";
import type { SessionControl } from "../../workers/session-control.js";
import type { TaskIntake } from "../../workers/task-intake.js";
import {
  defineTool,
  instructionArg,
  needProject,
  projectArg,
  sessionNumberArg,
  text,
  type OperatorTool,
} from "./tool-kit.js";
import type { WorkSessions } from "./work-sessions.js";

export function listSessions(status: StatusReport, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "list_sessions",
    description: "A project's open sessions with their status; marks the active one.",
    args: { project: projectArg },
    run: ({ project }) => text(status.sessionList(needProject(cfg, project))),
  });
}

export function newSession(workSessions: WorkSessions, intake: TaskIntake, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "new_session",
    description:
      "The default for any new piece of work, even when the active session is idle: opens a fresh worker session " +
      "(or reuses one nothing was sent to yet) and makes it active. Give an instruction to start it as the " +
      "session's first task in the same step.",
    args: { project: projectArg, instruction: instructionArg.optional() },
    run: ({ project, instruction }) => {
      const name = needProject(cfg, project);
      const { session, report } = workSessions.openForNewWork(name);
      const started = instruction === undefined ? "" : intake.runInSession(session.id, instruction);
      return text(sentences(report, started, workSessions.crowdingHint(name)));
    },
  });
}

function sentences(...parts: string[]): string {
  return parts.filter(Boolean).join(" ");
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

export function closeOtherSessions(workSessions: WorkSessions, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "close_other_sessions",
    description:
      "Close every session of a project except the active one, deleting their queues and history. Sessions whose " +
      "worker is running are skipped and stay open.",
    args: { project: projectArg },
    run: async ({ project }) => text(await workSessions.closeOthers(needProject(cfg, project))),
  });
}
