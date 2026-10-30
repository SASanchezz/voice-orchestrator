// The Review view's right side: one project's files as one scroll. A file's diff loads when you scroll near it.

import type { ChangedFileView, ProjectChangesView } from "../change-views.js";
import { fetchFileDiff } from "./api.js";
import { button, byId, el } from "./dom.js";
import { diffFile, fillDiff, syncDiffFile } from "./diff-file.js";

/** Starts loading a little before a file scrolls into view. */
const LOAD_AHEAD = "600px";

let observer: IntersectionObserver | undefined;

export function showDiffsOf({ project, files }: ProjectChangesView): void {
  observer?.disconnect();
  observer = new IntersectionObserver((entries) => loadVisible(project, entries), { rootMargin: LOAD_AHEAD });
  const sections = files.map((file) => diffFile(project, file));
  byId("diff-pane", HTMLElement).replaceChildren(refreshBar(), ...sections);
  for (const section of sections) observer.observe(section);
}

function loadVisible(project: string, entries: IntersectionObserverEntry[]): void {
  for (const entry of entries) {
    if (!entry.isIntersecting || !(entry.target instanceof HTMLDetailsElement)) continue;
    observer?.unobserve(entry.target);
    void loadInto(project, entry.target);
  }
}

async function loadInto(project: string, section: HTMLDetailsElement): Promise<void> {
  const path = section.dataset.path ?? "";
  fillDiff(section, await fetchFileDiff(project, path));
}

function refreshBar(): HTMLDivElement {
  const bar = el("div", { class: "diff-refresh", id: "diff-refresh" }, "These changes moved on.");
  bar.hidden = true;
  return bar;
}

/** New changes wait for you, so what you're reading stays put. */
export function markDiffsOutdated(isOutdated: boolean, refresh: () => void): void {
  const bar = document.getElementById("diff-refresh");
  if (!bar) return;
  bar.hidden = !isOutdated;
  bar.replaceChildren("These changes moved on.", button("Refresh", "ghost", refresh));
}

export function showNoDiffs(project: string | undefined): void {
  observer?.disconnect();
  const message = project ? `${project} has no uncommitted changes.` : "Pick a project to see its changes.";
  byId("diff-pane", HTMLElement).replaceChildren(el("p", { class: "empty" }, message));
}

/** Opens a file's diff and scrolls to it. */
export function revealDiff(path: string): void {
  const sections = document.querySelectorAll<HTMLDetailsElement>(".diff-file");
  const section = [...sections].find((candidate) => candidate.dataset.path === path);
  if (!section) return;
  section.open = true;
  section.scrollIntoView({ block: "start" });
}

/** A file marked reviewed from the list folds here too. */
export function syncReviewed(project: string, file: ChangedFileView): void {
  const sections = document.querySelectorAll<HTMLDetailsElement>(".diff-file");
  const section = [...sections].find((candidate) => candidate.dataset.path === file.path);
  if (section) syncDiffFile(section, project, file);
}
