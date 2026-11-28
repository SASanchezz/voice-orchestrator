import type { WorkerEffort } from "./worker-efforts.js";

/** A task as its worker starts it: where it runs, on which account, and the conversation it resumes. */
export interface RunningTask {
  sessionId: string;
  project: string;
  sessionNumber: number;
  instruction: string;
  /** The project's account; it can't change while the project is busy. */
  account: string;
  /** The Claude model it runs on: its own, else its session's, else its project's; unset, Claude Code's default. */
  model?: string;
  /** How hard it thinks: its session's effort; unset, Claude Code's default. */
  effort?: WorkerEffort;
  /** Claude Code's own session id, if the session has talked before. */
  resume?: string;
  /** The summary a fresh session took over from an earlier one; its first task starts with it. */
  handoff?: string;
}
