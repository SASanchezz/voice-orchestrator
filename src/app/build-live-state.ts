import { ProjectsWithJobs } from "../ui/server/projects-with-jobs.js";
import { UiStateView } from "../ui/server/ui-state-view.js";
import type { UiSources } from "./build-ui.js";
import { voiceViews } from "./build-ui-voice.js";
import type { UiNeighbors } from "./ui-neighbors.js";

/** What the page shows that can change at any moment: projects and their sessions' jobs, what waits on you, voice. */
export function liveStateView(
  neighbors: UiNeighbors,
  sources: Pick<UiSources, "lookup" | "waiting" | "operator">,
): UiStateView {
  const projects = new ProjectsWithJobs(sources.lookup, neighbors.workers.backgroundJobs);
  return new UiStateView(projects, sources.waiting, voiceViews(sources.operator, neighbors.devices));
}
