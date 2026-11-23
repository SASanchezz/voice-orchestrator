// Fold all and Unfold all over the Review view's files, to skim a long change by file names or read all of it.
// An unfolded file loads its diff when it scrolls near, as one opened by hand does.

import { button, el } from "./dom.js";

export function foldButtons(): HTMLDivElement {
  return el(
    "div",
    { class: "diff-folding" },
    button("Fold all", "ghost", foldAll),
    button("Unfold all", "ghost", unfoldAll),
  );
}

function foldAll(): void {
  for (const section of diffSections()) section.open = false;
}

function unfoldAll(): void {
  for (const section of diffSections()) section.open = true;
}

function diffSections(): NodeListOf<HTMLDetailsElement> {
  return document.querySelectorAll<HTMLDetailsElement>(".diff-file");
}
