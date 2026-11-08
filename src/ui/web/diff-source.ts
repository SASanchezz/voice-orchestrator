// Where the Review view's diffs come from: a project's uncommitted changes, or what one branch adds to another.

import type { ComparisonView } from "../change-views.js";
import { changesRoute, comparisonRoute, type DiffRoute } from "./api.js";

export interface DiffSource {
  project: string;
  /** Differs between sources, so switching from one to another reloads the diffs. */
  key: string;
  route: DiffRoute;
  /** Only the working tree's changes can be staged; a branch's are already committed. */
  canStage: boolean;
}

export function uncommittedSource(project: string): DiffSource {
  return { project, key: `${project}\nchanges`, route: changesRoute(project), canStage: true };
}

export function branchSource(project: string, comparison: ComparisonView): DiffSource {
  const key = `${project}\n${comparison.head}\n${comparison.base}`;
  return { project, key, route: comparisonRoute(project, comparison), canStage: false };
}
