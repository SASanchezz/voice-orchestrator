import type { BackgroundJobView } from "../ui/session-protocol.js";
import {
  backgroundOutputFiles,
  isFreshProcess,
  type LiveTask,
  liveTasksIn,
  progressIn,
  type TaskProgress,
} from "./background-job-messages.js";
import { lastOutputLine } from "./output-tail.js";

interface TrackedJob {
  description: string;
  startedAt: number;
  /** A helper agent's latest step; a command's comes from its output file instead. */
  step: string;
}

/**
 * The background commands and helper agents each worker session is waiting on, from Claude Code's own task events.
 * A new run starts a fresh Claude Code process, which knows of none, so its first message clears the session's list.
 */
export class BackgroundJobs {
  private jobsBySession = new Map<string, Map<string, TrackedJob>>();
  private outputFiles = new Map<string, string>();

  /** Any message from the worker; those about no background task are ignored. */
  follow(sessionId: string, msg: unknown): void {
    if (isFreshProcess(msg)) return this.replace(sessionId, []);
    const liveTasks = liveTasksIn(msg);
    if (liveTasks) return this.replace(sessionId, liveTasks);
    const progress = progressIn(msg);
    if (progress) return this.updateStep(sessionId, progress);
    for (const [taskId, path] of backgroundOutputFiles(msg)) this.outputFiles.set(taskId, path);
  }

  jobsOf(sessionId: string): BackgroundJobView[] {
    const jobs = this.jobsBySession.get(sessionId) ?? new Map<string, TrackedJob>();
    return [...jobs].map(([taskId, job]) => this.toView(taskId, job));
  }

  /** Claude Code sends the whole set of live tasks each time it changes, so it replaces what was known. */
  private replace(sessionId: string, tasks: LiveTask[]): void {
    const known = this.jobsBySession.get(sessionId) ?? new Map<string, TrackedJob>();
    const live = new Map<string, TrackedJob>();
    for (const task of tasks.filter((liveTask) => !liveTask.ambient))
      live.set(task.task_id, known.get(task.task_id) ?? BackgroundJobs.newJob(task));
    for (const taskId of known.keys()) if (!live.has(taskId)) this.outputFiles.delete(taskId);
    this.jobsBySession.set(sessionId, live);
  }

  private static newJob({ description }: LiveTask): TrackedJob {
    return { description, startedAt: Date.now(), step: "" };
  }

  private updateStep(sessionId: string, progress: TaskProgress): void {
    const job = this.jobsBySession.get(sessionId)?.get(progress.task_id);
    if (job) job.step = progress.summary ?? progress.last_tool_name ?? job.step;
  }

  private toView(taskId: string, { description, startedAt, step }: TrackedJob): BackgroundJobView {
    const outputFile = this.outputFiles.get(taskId);
    const printed = outputFile ? lastOutputLine(outputFile) : "";
    return { description, startedAt, step: printed || step };
  }
}
