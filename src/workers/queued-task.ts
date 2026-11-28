// No imports, so the page bundles it too.

/** An instruction for a session's worker; with a model, that one task runs on it instead of the session's model. */
export interface QueuedTask {
  instruction: string;
  model?: string;
}

/** A task waiting in a session's queue, as state/registry.json saves it and the page gets it. */
export interface QueueItem extends QueuedTask {
  /** Stays the same while the task waits, so removing or editing it never hits another one after the queue moved. */
  id: string;
}
