import { z } from "zod";
import type { AppConfig } from "../../config/app-config.js";
import type { Registry } from "../../registry/registry.js";
import type { QueuedTasks } from "../../workers/queued-tasks.js";
import {
  defineTool,
  needProject,
  optionalSessionArg,
  projectArg,
  sessionOf,
  text,
  type OperatorTool,
} from "./tool-kit.js";

const removeArgs = {
  project: projectArg,
  session: optionalSessionArg,
  place: z.number().int().positive().optional().describe("Its place in the queue, from 1, as list_queued_tasks shows"),
  match: z.string().optional().describe("Words from its instruction, e.g. 'footer'"),
};

export function listQueuedTasks(queuedTasks: QueuedTasks, registry: Registry, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "list_queued_tasks",
    description: "The tasks waiting in a session's queue, numbered by place (#1 runs next).",
    args: { project: projectArg, session: optionalSessionArg },
    run: ({ project, session }) => text(queuedTasks.list(sessionOf(registry, needProject(cfg, project), session).id)),
  });
}

export function removeQueuedTask(queuedTasks: QueuedTasks, registry: Registry, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "remove_queued_task",
    description:
      "Drop one task from a session's queue. The running task and the rest of the queue are untouched. " +
      "Give its place, words from its instruction, or both.",
    args: removeArgs,
    run: ({ project, session, place, match }) =>
      text(queuedTasks.remove(sessionOf(registry, needProject(cfg, project), session).id, { place, match })),
  });
}
