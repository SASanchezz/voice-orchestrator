// Which of a folder's repositories the Review view shows the uncommitted changes of, for a project whose folder holds
// several. All of them until you pick one; the pick is remembered per project across reloads.

import type { ChangedFileView, ProjectChangesView } from "../change-views.js";
import { localRead, localWrite } from "./dom.js";
import { store } from "./store.js";

const STORAGE_PREFIX = "review-uncommitted-repository:";
export const ALL_REPOSITORIES = "";

/** Falls back to all of them once the picked repository is gone. */
export function uncommittedRepositoryOf(view: ProjectChangesView): string {
  const remembered = localRead(STORAGE_PREFIX + view.project) ?? ALL_REPOSITORIES;
  return view.repositories?.includes(remembered) ? remembered : ALL_REPOSITORIES;
}

export function showUncommittedIn(project: string, repository: string): void {
  localWrite(STORAGE_PREFIX + project, repository);
  store.rerender();
}

/** Only the picked repository's files. */
export function uncommittedShown(view: ProjectChangesView): ProjectChangesView {
  const repository = uncommittedRepositoryOf(view);
  if (repository === ALL_REPOSITORIES) return view;
  return { ...view, files: filesIn(view.files, repository), moreFiles: 0 };
}

export function filesIn(files: ChangedFileView[], repository: string): ChangedFileView[] {
  return files.filter((file) => repositoryOfFile(file) === repository);
}

/** In a folder of repositories, a file's path starts with its repository's folder. */
export function repositoryOfFile({ path }: ChangedFileView): string {
  return path.split("/")[0];
}
