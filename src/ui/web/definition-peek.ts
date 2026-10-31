// The panel under the diffs that a jump opens, as VS Code's peek: every place a name is defined and the code there.
// Names in that code link with a plain click, because a click has no other meaning there.

import type { DefinitionView } from "../change-views.js";
import { fetchDefinitions } from "./api.js";
import { button, byId, el } from "./dom.js";
import { codeWithSymbols, onSymbolClick } from "./symbol-links.js";

let latestLookup = 0;

export async function showDefinitions(project: string, symbol: string, file: string): Promise<void> {
  const lookup = ++latestLookup;
  renderPeek(symbol, el("p", { class: "diff-note" }, "Looking…"));
  const body = await peekBody(project, symbol, file);
  if (lookup === latestLookup) renderPeek(symbol, body);
}

export function closeDefinitions(): void {
  latestLookup += 1;
  byId("definition-peek", HTMLElement).hidden = true;
}

async function peekBody(project: string, symbol: string, file: string): Promise<HTMLElement> {
  try {
    const definitions = await fetchDefinitions(project, symbol, file);
    if (!definitions.length) return el("p", { class: "diff-note" }, `No definition found for ${symbol}.`);
    return definitionsBody(project, definitions);
  } catch (error) {
    return el("p", { class: "diff-note" }, error instanceof Error ? error.message : String(error));
  }
}

function renderPeek(symbol: string, body: HTMLElement): void {
  const peek = byId("definition-peek", HTMLElement);
  const head = el(
    "div",
    { class: "peek-head" },
    el("strong", {}, symbol),
    el("span", { class: "muted" }, "definitions"),
    button("Close", "ghost", closeDefinitions),
  );
  peek.replaceChildren(head, body);
  peek.hidden = false;
}

function definitionsBody(project: string, definitions: DefinitionView[]): HTMLElement {
  const code = el("div", { class: "peek-code" });
  const places = definitions.map((definition) => placeButton(definition, code));
  const body = el("div", { class: "peek-body" }, el("div", { class: "peek-places" }, ...places), code);
  places[0].click();
  onSymbolClick(code, (symbol) => void showDefinitions(project, symbol, definitions[0].path));
  return body;
}

function placeButton(definition: DefinitionView, code: HTMLElement): HTMLButtonElement {
  const { path, line, kind } = definition;
  const place = el(
    "button",
    { type: "button", class: "peek-place", title: `${path}:${line}` },
    el("span", {}, `‎${path}:${line}`),
    el("span", { class: "muted" }, kind),
  );
  place.addEventListener("click", () => selectPlace(place, definition, code));
  return place;
}

function selectPlace(place: HTMLButtonElement, definition: DefinitionView, code: HTMLElement): void {
  for (const other of place.parentElement?.children ?? []) other.classList.remove("selected");
  place.classList.add("selected");
  code.replaceChildren(...definition.snippet.map(({ line, text }) => snippetRow(line, text, definition.line)));
}

function snippetRow(line: number, text: string, targetLine: number): HTMLDivElement {
  const number = el("span", { class: "diff-number" }, String(line));
  const code = el("span", { class: "diff-text" }, ...codeWithSymbols(text));
  return el("div", { class: `diff-line${line === targetLine ? " peek-target" : ""}` }, number, code);
}
