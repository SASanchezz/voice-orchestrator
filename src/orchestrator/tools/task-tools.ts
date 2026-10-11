import { z } from "zod";
import type { AppConfig } from "../../config/app-config.js";
import type { ChangeSummarizer } from "../../workers/change-summarizer.js";
import type { SessionControl } from "../../workers/session-control.js";
import type { TaskIntake } from "../../workers/task-intake.js";
import type { GitCommands } from "../actions/git-commands.js";
import { defineTool, needProject, projectArg, text, type OperatorTool } from "./tool-kit.js";

export function runTask(intake: TaskIntake, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "run_task",
    description: "Send an instruction to a project's coding worker. Queued if it is busy.",
    args: { project: projectArg, instruction: z.string().describe("What the worker should do, in plain words") },
    run: ({ project, instruction }) => text(intake.run(needProject(cfg, project), instruction)),
  });
}

export function stopTask(control: SessionControl, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "stop_task",
    description: "Stop a running worker and clear its queue.",
    args: { project: projectArg },
    run: ({ project }) => text(control.stop(needProject(cfg, project))),
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
