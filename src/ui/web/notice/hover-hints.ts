// After a long hover, a button's hint: what it does and its keyboard shortcut, so the shortcuts are easy to learn.
// The panel doesn't take focus until you click it, so the page may not see the pointer; the native panel passes it on.

import { isNoticeCommand, shortcutOf } from "./notice-shortcuts.js";

const LONG_HOVER_MS = 600;
/** A button that runs a command when clicked, or one that only shows its shortcut (it is wired on its own). */
const HINTED = "[data-command], [data-shortcut]";
const GAP_PX = 6;
const EDGE_PX = 4;

export class HoverHints {
  private target?: HTMLElement;
  private timer?: number;

  constructor(private hint: HTMLElement) {}

  /** The pointer is at (x, y) in the page. */
  pointAt(x: number, y: number): void {
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>(HINTED) ?? undefined;
    if (target === this.target) return;
    this.hide();
    this.target = target;
    if (target) this.timer = window.setTimeout(() => this.show(target), LONG_HOVER_MS);
  }

  /** The pointer left the page, or you clicked or typed: the hint goes until the next long hover. */
  hide(): void {
    window.clearTimeout(this.timer);
    this.hint.hidden = true;
  }

  forget(): void {
    this.hide();
    this.target = undefined;
  }

  private show(target: HTMLElement): void {
    this.hint.textContent = hintOf(target);
    this.hint.hidden = false;
    placeNear(this.hint, target.getBoundingClientRect());
  }
}

/** "Open session  ⌘2". A title moves into the hint, so the browser's own tooltip doesn't show it a second time. */
function hintOf(target: HTMLElement): string {
  if (target.title) {
    target.dataset.hint = target.title;
    target.removeAttribute("title");
  }
  const what = target.dataset.hint ?? target.getAttribute("aria-label") ?? target.textContent?.trim() ?? "";
  const command = target.dataset.command ?? target.dataset.shortcut;
  return isNoticeCommand(command) ? `${what}  ${shortcutOf(command)}` : what;
}

/** Above the button when there is room, below it otherwise, and never past the panel's edges. */
function placeNear(hint: HTMLElement, button: DOMRect): void {
  const { width, height } = hint.getBoundingClientRect();
  const above = button.top - height - GAP_PX;
  const left = Math.min(Math.max(button.left, EDGE_PX), window.innerWidth - width - EDGE_PX);
  hint.style.left = `${left}px`;
  hint.style.top = `${above >= EDGE_PX ? above : button.bottom + GAP_PX}px`;
}
