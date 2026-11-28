// How hard a worker session thinks before it answers: Claude Code's effort levels. No imports, so the page bundles it
// and the server validates against it.

export const WORKER_EFFORT_IDS = ["low", "medium", "high", "xhigh", "max"] as const;
export type WorkerEffort = (typeof WORKER_EFFORT_IDS)[number];

const LABELS: Record<WorkerEffort, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
  max: "Max",
};

/** Claude Code's own effort, from its settings, when the session picked none. */
const DEFAULT_EFFORT_LABEL = "Default";

export function effortLabel(effort: WorkerEffort | undefined): string {
  return effort === undefined ? DEFAULT_EFFORT_LABEL : LABELS[effort];
}
