// The compare bar's repository picker in Uncommitted mode, for a project whose folder holds several repositories:
// all of them at once, or one, each with how many of its files aren't committed.

import type { PickerOption } from "../picker-match.js";
import type { ProjectChangesView } from "../change-views.js";
import { searchPicker } from "./search-picker.js";
import { ALL_REPOSITORIES, filesIn, showUncommittedIn, uncommittedRepositoryOf } from "./uncommitted-repository.js";

const LABEL = "Repository to show uncommitted changes of";

/** Nothing for a project whose folder is a repository itself. */
export function uncommittedPickers(view: ProjectChangesView): HTMLElement[] {
  const repositories = view.repositories ?? [];
  if (!repositories.length) return [];
  const all: PickerOption = {
    value: ALL_REPOSITORIES,
    label: "All repositories",
    detail: fileCount(view.files.length),
  };
  const options = [all, ...repositories.map((repository) => repositoryOption(view, repository))];
  const choice = { label: LABEL, options, selected: uncommittedRepositoryOf(view) };
  const picker = searchPicker(choice, (repository) => showUncommittedIn(view.project, repository));
  picker.classList.add("repository-picker");
  return [picker];
}

/** A key that changes whenever the picker would look different. */
export function uncommittedPickerKey(view: ProjectChangesView): string {
  const counts = (view.repositories ?? []).map((repository) => repositoryOption(view, repository).detail);
  return [uncommittedRepositoryOf(view), ...(view.repositories ?? []), ...counts].join("\n");
}

function repositoryOption(view: ProjectChangesView, repository: string): PickerOption {
  return { value: repository, label: repository, detail: fileCount(filesIn(view.files, repository).length) };
}

function fileCount(count: number): string {
  if (!count) return "clean";
  return count === 1 ? "1 file" : `${count} files`;
}
