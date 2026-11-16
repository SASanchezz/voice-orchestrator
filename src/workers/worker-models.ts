// The Claude models a worker session can run on. No imports, so the page bundles it and the server validates against it.

export const WORKER_MODEL_IDS = ["opus", "sonnet", "haiku", "claude-fable-5-1"] as const;
export type WorkerModel = (typeof WORKER_MODEL_IDS)[number];

const LABELS: Record<WorkerModel, string> = {
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku",
  "claude-fable-5-1": "Fable",
};

/** A model to pick: the id Claude Code takes, and the name the page shows. */
export interface WorkerModelChoice {
  id: WorkerModel;
  label: string;
}

export const WORKER_MODELS: WorkerModelChoice[] = WORKER_MODEL_IDS.map((id) => ({ id, label: LABELS[id] }));

/** Claude Code's own default when neither the session nor the project's config names a model. */
const DEFAULT_MODEL_LABEL = "Default";

/** Claude Code's alias for a model with the 1M-token context, as in "opus[1m]". */
const LONG_CONTEXT_SUFFIX = "[1m]";

/** "Opus" for "opus"; a model set in config.yaml that isn't on the list shows as its id. */
export function modelLabel(model: string | undefined): string {
  if (model === undefined) return DEFAULT_MODEL_LABEL;
  return listedModelOf(model)?.label ?? model;
}

/** The listed model an id names, its 1M-context alias included; unset for any other id. */
export function listedModelOf(model: string): WorkerModelChoice | undefined {
  const id = model.endsWith(LONG_CONTEXT_SUFFIX) ? model.slice(0, -LONG_CONTEXT_SUFFIX.length) : model;
  return WORKER_MODELS.find((known) => known.id === id);
}
