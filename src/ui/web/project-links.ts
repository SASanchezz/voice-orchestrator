// A link clicked in a project's chat or notice opens in the project's Chrome profile, which the server knows, rather
// than beside the web UI. Lines about a project carry its name in data-project; links elsewhere open as usual.

import { act } from "./api.js";
import { showProjectNote } from "./project-note.js";
import { store } from "./store.js";

export function wireProjectLinks(): void {
  document.addEventListener("click", openInProjectProfile);
}

/** The project's name for the lines inside `container`; none: they belong to no project. */
export function markProject(container: HTMLElement, project?: string): void {
  if (project) container.dataset.project = project;
  else delete container.dataset.project;
}

function openInProjectProfile(event: MouseEvent): void {
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  const project = link?.closest<HTMLElement>("[data-project]")?.dataset.project;
  if (!link || !project || !hasChromeProfile(project)) return;
  event.preventDefault();
  void openLink(link.href, project);
}

/** Says under the tabs which profile it opened in, so a profile Chrome lacks is noticed. */
async function openLink(url: string, project: string): Promise<void> {
  const reply = await act("/api/links/open", { url, project });
  if (reply) showProjectNote(project, reply);
}

function hasChromeProfile(project: string): boolean {
  return Boolean(store.state.projects.find((p) => p.name === project)?.chromeProfile);
}
