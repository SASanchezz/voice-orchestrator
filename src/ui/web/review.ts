// The Review view: every project's uncommitted changes in one place, in place of the code and chat. Its project is the
// selected one. New changes update the list at once; the diffs wait for your Refresh, so they never move while you read
// or lose a comment you're writing. Leaving the view keeps them, so coming back finds them loaded where you left off.
// The bar over the diffs switches a project to what one of its branches adds to another, as a pull request shows it.

import type { ProjectChangesView } from "../change-views.js";
import { changesVersion } from "../reviewed-files.js";
import { comparisonOf, isComparing } from "./branch-comparison.js";
import { renderChangeList } from "./change-list.js";
import { renderCompareBar } from "./compare-bar.js";
import {
  keepDiffScroll,
  markDiffsOutdated,
  restoreDiffScroll,
  showDiffNote,
  showDiffsOf,
  showNoDiffs,
} from "./diff-pane.js";
import { branchSource, type DiffSource, uncommittedSource } from "./diff-source.js";
import { byId } from "./dom.js";
import { store } from "./store.js";
import { wireSymbolKeys } from "./symbol-links.js";

let loadedVersion = "";
/** Which source the loaded diffs came from: a project's uncommitted changes, or two of its branches. */
let loadedSource = "";
let wasShown = false;

export function wireReview(): void {
  byId("review-button", HTMLButtonElement).addEventListener("click", toggleReview);
  wireSymbolKeys();
}

function toggleReview(): void {
  if (store.reviewShown) return store.hideReview();
  const firstChanged = store.changes.find((view) => view.files.length);
  if (!store.selectedProject() && firstChanged) store.select(firstChanged.project);
  store.showReview();
}

export function renderReview(): void {
  renderReviewButton();
  const isLeaving = wasShown && !store.reviewShown;
  const isReturning = store.reviewShown && !wasShown;
  wasShown = store.reviewShown;
  if (isLeaving) keepDiffScroll(); // read before the pane is hidden
  byId("review-panel", HTMLElement).hidden = !store.reviewShown;
  if (!store.reviewShown) return;
  renderChangeList();
  renderCompareBar();
  renderSelectedDiffs();
  if (isReturning) restoreDiffScroll();
}

function renderReviewButton(): void {
  const count = store.changes.reduce((sum, view) => sum + view.files.length, 0);
  const review = byId("review-button", HTMLButtonElement);
  review.textContent = count ? `Review ${count}` : "Review";
  review.classList.toggle("shown", store.reviewShown);
}

function forgetLoadedDiffs(): void {
  loadedVersion = "";
  loadedSource = "";
}

function renderSelectedDiffs(): void {
  const project = store.selectedProjectName;
  if (project && isComparing(project)) return renderComparedDiffs(project);
  renderUncommittedDiffs(store.changes.find((view) => view.project === project));
}

function renderUncommittedDiffs(view: ProjectChangesView | undefined): void {
  if (!view?.files.length) {
    forgetLoadedDiffs();
    return showNoDiffs(view?.project);
  }
  const source = uncommittedSource(view.project);
  if (source.key !== loadedSource) return loadDiffs(view, source);
  markDiffsOutdated(changesVersion(view) !== loadedVersion, () => loadDiffs(view, source));
}

/** A comparison changes only when you pick branches or press Refresh, so it reloads at once. */
function renderComparedDiffs(project: string): void {
  const { comparison, files } = comparisonOf(project);
  if ("note" in files) {
    forgetLoadedDiffs();
    return showDiffNote(files.note);
  }
  const source = branchSource(project, comparison);
  const isLoaded = source.key === loadedSource && changesVersion(files.view) === loadedVersion;
  if (!isLoaded) loadDiffs(files.view, source);
}

function loadDiffs(view: ProjectChangesView, source: DiffSource): void {
  loadedSource = source.key;
  loadedVersion = changesVersion(view);
  showDiffsOf(view, source);
}
