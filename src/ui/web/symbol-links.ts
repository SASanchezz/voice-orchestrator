// VS Code's links on names in code: ⌘-click (Ctrl-click elsewhere) jumps, and holding the key shows what would link.

import { codePieces } from "../code-symbols.js";
import { el } from "./dom.js";

const SYMBOL_CLASS = "diff-symbol";
const KEYS_HELD_CLASS = "symbol-keys-held";

/** A line of code as text, with each name in its own span. */
export function codeWithSymbols(line: string): (HTMLElement | string)[] {
  return codePieces(line).map(({ text, isSymbol }) => (isSymbol ? el("span", { class: SYMBOL_CLASS }, text) : text));
}

/** Runs before the row's own click, so jumping doesn't also aim a comment. */
export function onSymbolModifierClick(container: HTMLElement, jump: (symbol: string) => void): void {
  const jumpFromHeldClick = (event: MouseEvent): void => {
    const isHeld = event.metaKey || event.ctrlKey;
    const symbol = isHeld ? symbolAt(event) : "";
    if (!symbol) return;
    event.stopPropagation();
    event.preventDefault();
    jump(symbol);
  };
  container.addEventListener("click", jumpFromHeldClick, { capture: true });
}

/** For code where a click has no other meaning. */
export function onSymbolClick(container: HTMLElement, jump: (symbol: string) => void): void {
  container.addEventListener("click", (event) => {
    const symbol = symbolAt(event);
    if (symbol) jump(symbol);
  });
}

function symbolAt({ target }: MouseEvent): string {
  const isName = target instanceof HTMLElement && target.classList.contains(SYMBOL_CLASS);
  return isName ? (target.textContent ?? "") : "";
}

export function wireSymbolKeys(): void {
  document.addEventListener("keydown", showKeys);
  document.addEventListener("keyup", showKeys);
  window.addEventListener("blur", () => setKeysHeld(false));
}

function showKeys(event: KeyboardEvent): void {
  setKeysHeld(event.metaKey || event.ctrlKey);
}

function setKeysHeld(isHeld: boolean): void {
  document.body.classList.toggle(KEYS_HELD_CLASS, isHeld);
}
