// Which changed files you have reviewed. A mark holds the file's fingerprint, so a file that changes again needs a new
// look. Only types are imported, so the page bundles it and Node tests it.

import type { ChangedFileView, ProjectChangesView } from "./change-views.js";

/** Fingerprint of the reviewed state, by project and path. */
export type ReviewMarks = Record<string, string>;

export function isReviewed(marks: ReviewMarks, project: string, file: ChangedFileView): boolean {
  return marks[markKey(project, file.path)] === file.fingerprint;
}

export function withReview(marks: ReviewMarks, project: string, file: ChangedFileView): ReviewMarks {
  return { ...marks, [markKey(project, file.path)]: file.fingerprint };
}

export function withoutReview(marks: ReviewMarks, project: string, file: ChangedFileView): ReviewMarks {
  const { [markKey(project, file.path)]: _dropped, ...kept } = marks;
  return kept;
}

/** "+120 −8" over all of a project's files. */
export function changeTotals(view: ProjectChangesView): string {
  const additions = view.files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = view.files.reduce((sum, file) => sum + file.deletions, 0);
  return `+${additions} −${deletions}`;
}

/** Differs whenever a project's listed changes do. */
export function changesVersion(view: ProjectChangesView): string {
  return `${view.project}:${view.files.map((file) => file.path + file.fingerprint).join("|")}`;
}

/** What a comment on a diff tells the worker. */
export function reviewComment(path: string, newLine: number | undefined, comment: string): string {
  const place = newLine === undefined ? path : `${path} line ${newLine}`;
  return `Review comment on ${place}: ${comment}`;
}

function markKey(project: string, path: string): string {
  return `${project}\0${path}`;
}
