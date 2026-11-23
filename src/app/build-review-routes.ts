import { BranchCompare } from "../review/branch-compare.js";
import type { FolderChanges } from "../review/folder-changes.js";
import { GitDefinitions } from "../review/git-definitions.js";
import { ProjectRepositories } from "../review/project-repositories.js";
import { ChangesRoutes } from "../ui/server/changes-routes.js";
import { CompareRoutes } from "../ui/server/compare-routes.js";
import { DefinitionRoutes } from "../ui/server/definition-routes.js";
import { RepositoryLookup } from "../ui/server/repository-lookup.js";
import { ReviewRoutes } from "../ui/server/review-routes.js";
import type { UiAccess } from "../ui/server/ui-access.js";
import type { UiLookup } from "../ui/server/ui-lookup.js";

/** The Review view's reads: uncommitted changes, branch comparisons and where names are defined. */
export function reviewRoutes(access: UiAccess, lookup: UiLookup, changes: FolderChanges): ReviewRoutes {
  const changesRoutes = new ChangesRoutes(access, lookup, changes);
  const projectRepositories = new ProjectRepositories();
  const definitions = new DefinitionRoutes(access, lookup, new GitDefinitions(projectRepositories));
  const repositories = new RepositoryLookup(lookup, projectRepositories);
  return new ReviewRoutes(changesRoutes, definitions, new CompareRoutes(access, repositories, new BranchCompare()));
}
