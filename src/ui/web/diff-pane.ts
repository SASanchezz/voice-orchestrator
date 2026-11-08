// The Review view's right side: one project's files as one scroll. An open file's diff loads when you scroll near it;
// a folded one waits until you open it.

import type { ChangedFileView, ProjectChangesView } from "../change-views.js";
import { fetchFileDiff } from "./api.js";
import { closeDefinitions } from "./definition-peek.js";
import { button, byId, el } from "./dom.js";
import { diffFile, fillDiff, syncDiffFile } from "./diff-file.js";
import type { DiffSource } from "./diff-source.js";

/** Starts loading a little before a file scrolls into view. */
const LOAD_AHEAD = "600px";

const MODIFIER_KEY = navigator.platform.startsWith("Mac") ? "⌘" : "Ctrl";

let observer: IntersectionObserver | undefined;
const requestedSections = new WeakSet<HTMLDetailsElement>();
/** Where the pane was scrolled when the Review view was left; the pane forgets it while hidden. */
let keptScrollTop = 0;

export function showDiffsOf({ files }: ProjectChangesView, source: DiffSource): void {
  observer?.disconnect();
  closeDefinitions();
  keptScrollTop = 0;
  const pane = byId("diff-pane", HTMLElement);
  // The pane is the root, because it clips its sections: a margin on the window would never reach past its edges.
  observer = new IntersectionObserver((entries) => loadVisible(source, entries), {
    root: pane,
    rootMargin: LOAD_AHEAD,
  });
  const sections = files.map((file) => diffFile(file, source));
  pane.replaceChildren(refreshBar(), symbolHint(), ...sections);
  sections.forEach(watchSection);
}

/** Opening a folded file asks again whether it is near, since its place in the scroll didn't change. */
function watchSection(section: HTMLDetailsElement): void {
  observer?.observe(section);
  section.addEventListener("toggle", () => recheckSection(section));
}

function recheckSection(section: HTMLDetailsElement): void {
  if (requestedSections.has(section) || !section.isConnected) return;
  observer?.unobserve(section);
  observer?.observe(section);
}

function loadVisible(source: DiffSource, entries: IntersectionObserverEntry[]): void {
  for (const entry of entries) {
    const isNearOpenSection = entry.isIntersecting && entry.target instanceof HTMLDetailsElement && entry.target.open;
    if (isNearOpenSection) loadSection(source, entry.target);
  }
}

function loadSection(source: DiffSource, section: HTMLDetailsElement): void {
  requestedSections.add(section);
  observer?.unobserve(section);
  void loadInto(source, section);
}

/** A pane redrawn while the diff loaded has dropped the section, so the diff goes nowhere. */
async function loadInto(source: DiffSource, section: HTMLDetailsElement): Promise<void> {
  const path = section.dataset.path ?? "";
  const diff = await fetchFileDiff(source.route, path);
  if (section.isConnected) fillDiff(section, diff, source);
}

export function keepDiffScroll(): void {
  keptScrollTop = byId("diff-pane", HTMLElement).scrollTop;
}

export function restoreDiffScroll(): void {
  byId("diff-pane", HTMLElement).scrollTop = keptScrollTop;
}

function symbolHint(): HTMLParagraphElement {
  return el("p", { class: "diff-hint" }, `${MODIFIER_KEY}-click a name to go to its definition.`);
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
  showDiffNote(project ? `${project} has no uncommitted changes.` : "Pick a project to see its changes.");
}

/** In place of the diffs: why there are none, or that they are still loading. */
export function showDiffNote(message: string): void {
  observer?.disconnect();
  closeDefinitions();
  keptScrollTop = 0;
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
