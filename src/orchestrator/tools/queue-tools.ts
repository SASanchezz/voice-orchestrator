import { z } from "zod";
import type { AppConfig } from "../../config/app-config.js";
import type { Registry } from "../../registry/registry.js";
import type { QueueControl } from "../../workers/queue-control.js";
import type { QueuePick } from "../../workers/queue-pick.js";
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

const sessionArgs = { project: projectArg, session: optionalSessionArg };
const pickArgs = {
  ...sessionArgs,
  place: z.number().int().positive().optional().describe("Its place in the queue, from 1, as list_queued_tasks shows"),
  match: z.string().optional().describe("Words from its instruction, e.g. 'footer'"),
};
const editArgs = { ...pickArgs, instruction: z.string().min(1).describe("The task's new instruction, in full") };

interface SessionPickArgs extends QueuePick {
  project: string;
  session?: number;
}

/** What a queue tool needs to find the session and the queued task you mean. */
interface QueueLookup {
  queuedTasks: QueuedTasks;
  registry: Registry;
  cfg: AppConfig;
}

export function listQueuedTasks({ queuedTasks, registry, cfg }: QueueLookup): OperatorTool {
  return defineTool({
    name: "list_queued_tasks",
    description: "The tasks waiting in a session's queue, numbered by place (#1 runs next), and whether it is paused.",
    args: sessionArgs,
    run: ({ project, session }) => text(queuedTasks.list(sessionOf(registry, needProject(cfg, project), session).id)),
  });
}

export function removeQueuedTask(lookup: QueueLookup): OperatorTool {
  return defineTool({
    name: "remove_queued_task",
    description:
      "Drop one task from a session's queue. The running task and the rest of the queue are untouched. " +
      "Give its place, words from its instruction, or both.",
    args: pickArgs,
    run: (args) => {
      const { sessionId, taskId } = pickedTask(lookup, args);
      return text(lookup.queuedTasks.remove(sessionId, taskId));
    },
  });
}

export function editQueuedTask(lookup: QueueLookup): OperatorTool {
  return defineTool({
    name: "edit_queued_task",
    description: "Replace the instruction of one queued task that hasn't started yet; it keeps its place.",
    args: editArgs,
    run: (args) => {
      const { sessionId, taskId } = pickedTask(lookup, args);
      return text(lookup.queuedTasks.edit(sessionId, taskId, args.instruction));
    },
  });
}

export function runQueuedNext(lookup: QueueLookup): OperatorTool {
  return defineTool({
    name: "run_queued_next",
    description: "Move one queued task to the front of its session's queue, so it runs next.",
    args: pickArgs,
    run: (args) => {
      const { sessionId, taskId } = pickedTask(lookup, args);
      return text(lookup.queuedTasks.moveToFront(sessionId, taskId));
    },
  });
}

export function resumeQueue(control: QueueControl, registry: Registry, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "resume_queue",
    description: "Let a paused queue (after a failed or stopped task) run again, from its #1.",
    args: sessionArgs,
    run: ({ project, session }) => text(control.resume(sessionOf(registry, needProject(cfg, project), session).id)),
  });
}

export function clearQueue(control: QueueControl, registry: Registry, cfg: AppConfig): OperatorTool {
  return defineTool({
    name: "clear_queue",
    description: "Drop every task waiting in a session's queue; the running task goes on.",
    args: sessionArgs,
    run: ({ project, session }) => text(control.clear(sessionOf(registry, needProject(cfg, project), session).id)),
  });
}

interface PickedTask {
  sessionId: string;
  taskId: string;
}

function pickedTask({ queuedTasks, registry, cfg }: QueueLookup, args: SessionPickArgs): PickedTask {
  const sessionId = sessionOf(registry, needProject(cfg, args.project), args.session).id;
  return { sessionId, taskId: queuedTasks.idOf(sessionId, { place: args.place, match: args.match }) };
}
