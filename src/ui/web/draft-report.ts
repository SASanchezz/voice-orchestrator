// Tells the server how many files wait in this page's draft, so your voice message waits for your choice only then.

import { report } from "./api.js";

/** This page among the open ones; a reload is a new page with an empty draft. */
const PAGE_ID = crypto.randomUUID();

export function reportDraft(files: number): void {
  report("/api/draft", { page: PAGE_ID, files });
}

/** A page leaving takes its draft along; one coming back from the browser's history brings it back. */
export function reportDraftWhileShown(files: () => number): void {
  window.addEventListener("pagehide", () => reportDraft(0));
  window.addEventListener("pageshow", () => reportDraft(files()));
}
