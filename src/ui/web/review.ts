// The Review view: every project's uncommitted changes in one place, in place of the code and chat. Its project is the
// selected one. New changes update the list at once; the diffs wait for your Refresh, so they never move while you read
// or lose a comment you're writing.

import type { ProjectChangesView } from "../change-views.js";
import { changesVersion } from "../reviewed-files.js";
import { renderChangeList } from "./change-list.js";
import { markDiffsOutdated, showDiffsOf, showNoDiffs } from "./diff-pane.js";
import { byId } from "./dom.js";
import { store } from "./store.js";

let loadedVersion = "";
let loadedProject = "";

export function wireReview(): void {
  byId("review-button", HTMLButtonElement).addEventListener("click", toggleReview);
}

function toggleReview(): void {
  if (store.reviewShown) return store.hideReview();
  const firstChanged = store.changes.find((view) => view.files.length);
  if (!store.selectedProject() && firstChanged) store.select(firstChanged.project);
  store.showReview();
}

export function renderReview(): void {
  renderReviewButton();
  byId("review-panel", HTMLElement).hidden = !store.reviewShown;
  if (!store.reviewShown) return forgetLoadedDiffs();
  renderChangeList();
  renderDiffs(store.changes.find((view) => view.project === store.selectedProjectName));
}

function renderReviewButton(): void {
  const count = store.changes.reduce((sum, view) => sum + view.files.length, 0);
  const review = byId("review-button", HTMLButtonElement);
  review.textContent = count ? `Review ${count}` : "Review";
  review.classList.toggle("shown", store.reviewShown);
}

function forgetLoadedDiffs(): void {
  loadedVersion = "";
  loadedProject = "";
}

function renderDiffs(view: ProjectChangesView | undefined): void {
  if (!view?.files.length) {
    forgetLoadedDiffs();
    return showNoDiffs(view?.project);
  }
  if (view.project !== loadedProject) return loadDiffs(view);
  markDiffsOutdated(changesVersion(view) !== loadedVersion, () => loadDiffs(view));
}

function loadDiffs(view: ProjectChangesView): void {
  loadedProject = view.project;
  loadedVersion = changesVersion(view);
  showDiffsOf(view);
}
