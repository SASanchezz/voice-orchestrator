// No imports, so the page bundles it too.

/** A queued instruction as state/registry.json saves it and the page gets it. */
export type QueuedEntry = string | { instruction: string; model: string };

/** An instruction for a session's worker; with a model, that one task runs on it instead of the session's model. */
export interface QueuedTask {
  instruction: string;
  model?: string;
}

/** Saved as a plain string unless it has its own model, so queues without one keep their file format. */
export function toQueuedEntry({ instruction, model }: QueuedTask): QueuedEntry {
  return model === undefined ? instruction : { instruction, model };
}

export function fromQueuedEntry(entry: QueuedEntry): QueuedTask {
  return typeof entry === "string" ? { instruction: entry } : entry;
}

export function instructionOf(entry: QueuedEntry): string {
  return typeof entry === "string" ? entry : entry.instruction;
}
