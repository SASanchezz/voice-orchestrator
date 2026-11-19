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

/** `repository` is the one picked in a folder of repositories, or empty for all of them. */
export function uncommittedSource(project: string, repository: string): DiffSource {
  const key = `${project}\nchanges\n${repository}`;
  return { project, key, route: changesRoute(project), canStage: true };
}

export function branchSource(project: string, repository: string, comparison: ComparisonView): DiffSource {
  const key = `${project}\n${repository}\n${comparison.head}\n${comparison.base}`;
  return { project, key, route: comparisonRoute(project, repository, comparison), canStage: false };
}
