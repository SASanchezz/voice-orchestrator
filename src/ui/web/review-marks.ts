// Remembers in this browser which changed files you have reviewed.

import type { ChangedFileView } from "../change-views.js";
import { isReviewed, type ReviewMarks, withoutReview, withReview } from "../reviewed-files.js";
import { localRead, localWrite } from "./dom.js";
import { store } from "./store.js";

const MARKS_KEY = "reviewedFiles";

let marks = readMarks();

export function isMarkedReviewed(project: string, file: ChangedFileView): boolean {
  return isReviewed(marks, project, file);
}

export function setMarkedReviewed(project: string, file: ChangedFileView, reviewed: boolean): void {
  marks = reviewed ? withReview(marks, project, file) : withoutReview(marks, project, file);
  localWrite(MARKS_KEY, JSON.stringify(marks));
  store.rerender();
}

function readMarks(): ReviewMarks {
  try {
    const saved: unknown = JSON.parse(localRead(MARKS_KEY) ?? "{}");
    return isMarks(saved) ? saved : {};
  } catch {
    return {};
  }
}

function isMarks(saved: unknown): saved is ReviewMarks {
  return typeof saved === "object" && saved !== null;
}
