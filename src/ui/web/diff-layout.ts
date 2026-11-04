// Whether a file's diff in the Review view reads as one column of green and red rows or as the old and new file side
// by side. Every file starts as one column; a choice lasts while the page is open, through redraws.

import { button } from "./dom.js";

export type DiffLayout = "unified" | "split";

/** The toggle offers the layout you're not in. */
const TOGGLE_LABELS: Record<DiffLayout, string> = { unified: "Side by side", split: "Single view" };

const splitFiles = new Set<string>();
const redraws = new WeakMap<HTMLElement, (layout: DiffLayout) => void>();

export function layoutOf(project: string, path: string): DiffLayout {
  return splitFiles.has(fileKey(project, path)) ? "split" : "unified";
}

export function layoutToggle(project: string, path: string): HTMLButtonElement {
  const toggle = button(TOGGLE_LABELS[layoutOf(project, path)], "ghost", () => switchLayout(toggle, project, path));
  return toggle;
}

/** A loaded diff redraws itself through this when its layout changes. */
export function onLayoutChange(section: HTMLElement, redraw: (layout: DiffLayout) => void): void {
  redraws.set(section, redraw);
}

function switchLayout(toggle: HTMLButtonElement, project: string, path: string): void {
  const key = fileKey(project, path);
  if (!splitFiles.delete(key)) splitFiles.add(key);
  const layout = layoutOf(project, path);
  toggle.textContent = TOGGLE_LABELS[layout];
  const section = toggle.closest<HTMLElement>(".diff-file");
  if (section) redraws.get(section)?.(layout);
}

function fileKey(project: string, path: string): string {
  return `${project}\n${path}`;
}
