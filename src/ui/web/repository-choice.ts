// Which of a project's repositories the Review view compares branches in, remembered per project across reloads.

import type { RepositoryView } from "../change-views.js";
import { localRead, localWrite } from "./dom.js";

const STORAGE_PREFIX = "review-repository:";
/** What the server reads as the project's own folder, when it lists no repository at all. */
const PROJECT_FOLDER = "";

export function rememberRepository(project: string, repository: string): void {
  localWrite(STORAGE_PREFIX + project, repository);
}

/** The one picked last while it still exists, else the first. */
export function repositoryToCompare(project: string, repositories: RepositoryView[]): string {
  const remembered = localRead(STORAGE_PREFIX + project);
  const isListed = repositories.some((repository) => repository.folder === remembered);
  if (remembered !== undefined && isListed) return remembered;
  return repositories[0]?.folder ?? PROJECT_FOLDER;
}
