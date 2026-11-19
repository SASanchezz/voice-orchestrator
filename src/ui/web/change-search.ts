// The search box over the Review view's project list: type any part of a project's name, one of its repositories or a
// changed file to narrow the list, Enter to open the first match, Escape to clear. "/" jumps to it from anywhere in
// the view.

import type { ProjectChangesView } from "../change-views.js";
import { matchesQuery } from "../picker-match.js";
import { byId, isDialogOpen } from "./dom.js";
import { store } from "./store.js";

const FOCUS_KEY = "/";

let query = "";

export function wireChangeSearch(openFirstMatch: () => void): void {
  const input = byId("change-search", HTMLInputElement);
  input.addEventListener("input", () => searchFor(input.value));
  input.addEventListener("keydown", (key) => {
    if (key.key === "Enter") openFirstMatch();
    if (key.key !== "Escape") return;
    key.stopPropagation(); // clears the search instead of leaving the view
    input.value = "";
    searchFor("");
  });
  document.addEventListener("keydown", (key) => focusOnSlash(key, input));
}

export function matchesChangeSearch(view: ProjectChangesView): boolean {
  const names = [view.project, ...(view.repositories ?? []), ...view.files.map((file) => file.path)];
  return matchesQuery(names.join(" "), query);
}

/** What to say when nothing matches; empty while there is no search. */
export function noMatchNote(): string {
  return query ? `No project, repository or file matches “${query}”.` : "";
}

function searchFor(text: string): void {
  query = text.trim();
  store.rerender();
}

function focusOnSlash(key: KeyboardEvent, input: HTMLInputElement): void {
  const isModified = key.metaKey || key.ctrlKey || key.altKey;
  const isWanted = key.key === FOCUS_KEY && store.reviewShown && !isModified && !isDialogOpen();
  if (!isWanted || isTyping(key.target)) return;
  key.preventDefault();
  input.focus();
  input.select();
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"));
}
