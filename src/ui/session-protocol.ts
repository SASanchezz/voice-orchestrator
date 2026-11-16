// What the page gets about each worker session. It imports only types from files that import nothing, as protocol.ts.

import type { QueuedEntry } from "../workers/queued-task.js";

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
  queued: QueuedEntry[];
  /** The model the session chose; unset, it runs on its project's. */
  model?: string;
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
}
