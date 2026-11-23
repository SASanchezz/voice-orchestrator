import { CommandExplainer } from "../permissions/command-explainer.js";
import { CommandReviewer } from "../permissions/command-reviewer.js";
import type { ExplainCommand, ReviewCommand } from "../permissions/permission-types.js";
import { QuickModel } from "../workers/quick-model.js";
import type { Adapters } from "./build-app.js";
import type { Core } from "./core.js";

/** Plain-language explanations of commands, when the adapters want them. */
export function commandExplanations(core: Core, adapters: Adapters): ExplainCommand | undefined {
  if (!adapters.explainCommands) return undefined;
  const explainer = new CommandExplainer(core.cfg, core.projects, adapters.query);
  return (project, command) => explainer.explain(project, command);
}

/** A model passing routine calls that would otherwise ask you, when the adapters want it. */
export function commandReviews(core: Core, adapters: Adapters): ReviewCommand | undefined {
  if (!adapters.reviewCommands) return undefined;
  const reviewer = new CommandReviewer(core.cfg, new QuickModel(core.cfg, core.projects, adapters.query));
  return (project, call, rule) => reviewer.review(project, call, rule);
}
