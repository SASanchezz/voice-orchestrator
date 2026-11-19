// The compare bar's repository list in Branches mode, for a project whose folder holds several repositories. Each one
// shows its current branch, so you can see where work is going on before you pick it, and you can type to find one.

import type { RepositoryView } from "../change-views.js";
import type { PickerOption } from "../picker-match.js";
import { compareRepository, type ProjectComparison } from "./branch-comparison.js";
import { searchPicker } from "./search-picker.js";

const LABEL = "Repository to compare branches in";

/** Nothing when there is only one repository to pick. */
export function repositoryPickers(project: string, { repositories, repository }: ProjectComparison): HTMLElement[] {
  if (repositories.length < 2) return [];
  const choice = { label: LABEL, options: repositories.map(repositoryOption), selected: repository };
  const picker = searchPicker(choice, (folder) => void compareRepository(project, folder));
  picker.classList.add("repository-picker");
  return [picker];
}

/** A key that changes whenever the list would look different. */
export function repositoriesKey({ repositories, repository }: ProjectComparison): string {
  return [repository, ...repositories.map(({ folder, current }) => `${folder} ${current}`)].join("\n");
}

function repositoryOption({ folder, current }: RepositoryView): PickerOption {
  return { value: folder, label: folder, detail: current };
}
