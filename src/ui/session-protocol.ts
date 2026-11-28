// What the page gets about each worker session. It imports only types from files that import nothing, as protocol.ts.

import type { QueueItem } from "../workers/queued-task.js";
import type { WorkerEffort } from "../workers/worker-efforts.js";

export type SessionStatus = "idle" | "running" | "waiting_permission" | "done" | "failed" | "stopped";

export interface TaskRecordView {
  task: string;
  outcome: "done" | "failed" | "stopped";
  result: string;
  finishedAt: string;
}

export interface SessionView {
  id: string;
  number: number;
  status: SessionStatus;
  /** A few words naming what the session is about, once a model has written them. */
  title?: string;
  task?: string;
  queued: QueueItem[];
  /** Its queue waits after a failed or stopped task, until you resume or clear it. */
  queuePaused?: boolean;
  /** The model the session chose; unset, it runs on its project's. */
  model?: string;
  /** The effort the session chose; unset, Claude Code's default. */
  effort?: WorkerEffort;
  /** ISO times of the latest task start, task end and queued instruction. */
  startedAt?: string;
  finishedAt?: string;
  queuedAt?: string;
  lastActivity?: string;
  lastError?: string;
  costUsd: number;
  /** Tokens the worker's latest call read: how full its context is. */
  contextTokens?: number;
  /** Its model's context window, once a result reported it. */
  contextWindow?: number;
  history: TaskRecordView[];
  /** Commands and helpers the worker left running while it waits for them to report back. */
  backgroundJobs?: BackgroundJobView[];
}

/** A command or helper agent a worker runs in the background; its session stays busy until it reports back. */
export interface BackgroundJobView {
  description: string;
  /** Epoch ms when the page first heard of it. */
  startedAt: number;
  /** The last line it printed, or a helper's latest step; empty until there is one. */
  step: string;
}

/** A closed session the page can reopen: its Claude conversation, title and ISO time it was last active. */
export interface ClosedSessionView {
  claudeSessionId: string;
  title: string;
  lastActive: string;
}
