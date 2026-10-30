// The to-do list grouped by project, as the page shows it.
// No runtime imports, so the page bundles it and Node tests it.

import type { TodoItemView } from "./protocol.js";

/** The group of items that belong to no project. */
export const NO_PROJECT = "";

export interface TodoGroup {
  /** NO_PROJECT for the items without one. */
  project: string;
  items: TodoItemView[];
}

/**
 * Items under their projects, in the order the projects are listed; a project no longer listed comes after them, so
 * its items still show, and the items without a project come last. Projects without items are left out.
 */
export function groupByProject(items: TodoItemView[], listedProjects: string[]): TodoGroup[] {
  const order = new Set([...listedProjects, ...items.map(projectOf).filter(Boolean), NO_PROJECT]);
  return [...order].map((project) => groupOf(items, project)).filter((group) => group.items.length);
}

function groupOf(items: TodoItemView[], project: string): TodoGroup {
  return { project, items: items.filter((item) => projectOf(item) === project) };
}

function projectOf(item: TodoItemView): string {
  return item.project ?? NO_PROJECT;
}
