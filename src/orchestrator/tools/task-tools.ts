import { z } from "zod";
import type { AppConfig } from "../../config/app-config.js";
import type { Registry } from "../../registry/registry.js";
import type { ChangeSummarizer } from "../../workers/change-summarizer.js";
import type { SessionControl } from "../../workers/session-control.js";
import type { TaskIntake } from "../../workers/task-intake.js";
import type { GitCommands } from "../actions/git-commands.js";
import {
  defineTool,
  instructionArg,
  needProject,
  optionalSessionArg,
  projectArg,
  sessionOf,
  text,
  type OperatorTool,
} from "./tool-kit.js";

export function runTask(intake: TaskIntake, registry: Registry, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "run_task",
    description:
      "Send an instruction to one session's coding worker: the session with this number, or the project's active " +
      "session if none is given. Queued if that session is busy. Only for a follow-up to that session's current or " +
      "last task; other work goes to new_session.",
    args: { project: projectArg, session: optionalSessionArg, instruction: instructionArg },
    run: ({ project, session, instruction }) => {
      const target = sessionOf(registry, needProject(cfg, project), session);
      return text(intake.runInSession(target.id, instruction));
    },
  });
}

export function stopTask(control: SessionControl, registry: Registry, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "stop_task",
    description:
      "Stop the running worker of one session, the project's active session unless a number is given, and clear " +
      "that session's queue. The project's other sessions keep running. To drop just one queued task, use remove_queued_task.",
    args: { project: projectArg, session: optionalSessionArg },
    run: ({ project, session }) =>
      text(control.stopSession(sessionOf(registry, needProject(cfg, project), session).id)),
  });
}

export function summarizeChanges(summarizer: ChangeSummarizer, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "summarize_changes",
    description:
      "3-4 sentence spoken explanation of the latest implementation, generated on the project's own account.",
    args: { project: projectArg, focus: z.string().optional() },
    run: async ({ project, focus }) => text(await summarizer.summarize(needProject(cfg, project), focus)),
  });
}

export function git(commands: GitCommands, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "git",
    description:
      "Run a git command in the project, e.g. 'add -A', 'status --short'. Destructive ones need the confirm phrase.",
    args: { project: projectArg, args: z.string().describe("Arguments after 'git'") },
    run: async ({ project, args }) => text(await commands.run(needProject(cfg, project), args)),
  });
}
