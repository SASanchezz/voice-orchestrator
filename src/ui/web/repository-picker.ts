// The compare bar's repository list, for a project whose folder holds several repositories. Each one shows its current
// branch, so you can see where work is going on before you pick it.

import type { RepositoryView } from "../change-views.js";
import { compareRepository, type ProjectComparison } from "./branch-comparison.js";
import { el } from "./dom.js";

const LABEL = "Repository to compare branches in";

/** Nothing when there is only one repository to pick. */
export function repositoryPickers(project: string, { repositories, repository }: ProjectComparison): HTMLElement[] {
  if (repositories.length < 2) return [];
  const select = el("select", { class: "repository-picker", "aria-label": LABEL, title: LABEL });
  select.append(...repositories.map(repositoryOption));
  select.value = repository;
  select.addEventListener("change", () => void compareRepository(project, select.value));
  return [select];
}

/** A key that changes whenever the list would look different. */
export function repositoriesKey({ repositories, repository }: ProjectComparison): string {
  return [repository, ...repositories.map(optionText)].join("\n");
}

function repositoryOption(repository: RepositoryView): HTMLOptionElement {
  return el("option", { value: repository.folder }, optionText(repository));
}

function optionText({ folder, current }: RepositoryView): string {
  return current ? `${folder} · ${current}` : folder;
}
