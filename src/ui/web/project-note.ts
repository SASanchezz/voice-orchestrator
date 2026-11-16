// A short note under a project's tabs for a while: what a tab menu's sweep closed and skipped, or where a link opened.

import type { ProjectView } from "../protocol.js";
import { el } from "./dom.js";
import { store } from "./store.js";

const SHOWN_MS = 10000;

interface ProjectNote {
  project: string;
  text: string;
}

let shown: ProjectNote | undefined;
let expiry: ReturnType<typeof setTimeout> | undefined;

/** A newer note replaces the one shown and restarts its wait. */
export function showProjectNote(project: string, text: string): void {
  clearTimeout(expiry);
  shown = { project, text };
  expiry = setTimeout(hideProjectNote, SHOWN_MS);
  store.rerender();
}

function hideProjectNote(): void {
  shown = undefined;
  store.rerender();
}

export function projectNote(project: ProjectView): HTMLParagraphElement[] {
  if (shown?.project !== project.name) return [];
  return [el("p", { class: "project-note", role: "status" }, shown.text)];
}
