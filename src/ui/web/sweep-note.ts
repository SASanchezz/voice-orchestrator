// What a tab menu's "Close other sessions" or "Close all sessions" closed and skipped, under the tabs for a while.

import type { ProjectView } from "../protocol.js";
import { el } from "./dom.js";
import { store } from "./store.js";

const SHOWN_MS = 10000;

interface SweepNote {
  project: string;
  text: string;
}

let shown: SweepNote | undefined;
let expiry: ReturnType<typeof setTimeout> | undefined;

/** A newer note replaces the one shown and restarts its wait. */
export function showSweepNote(project: string, text: string): void {
  clearTimeout(expiry);
  shown = { project, text };
  expiry = setTimeout(hideSweepNote, SHOWN_MS);
  store.rerender();
}

function hideSweepNote(): void {
  shown = undefined;
  store.rerender();
}

export function sweepNote(project: ProjectView): HTMLParagraphElement[] {
  if (shown?.project !== project.name) return [];
  return [el("p", { class: "session-sweep-note", role: "status" }, shown.text)];
}
