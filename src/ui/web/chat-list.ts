// The chat's list on the page: replaced whole, or grown line by line while you read the newest lines.

import { byId, bySelector } from "./dom.js";

/** How close to the bottom counts as reading the newest messages, so new ones scroll into view. */
const STICK_TO_BOTTOM_PX = 40;
/** Long enough to find the lines and start selecting their text. */
const HIGHLIGHT_MS = 8000;

export class ChatList {
  private list = byId("feed", HTMLOListElement);
  private wrap = bySelector(".feed-wrap", HTMLElement);

  render(items: HTMLLIElement[]): void {
    this.list.replaceChildren(...items);
    this.wrap.scrollTop = this.wrap.scrollHeight;
  }

  append(item: HTMLLIElement): void {
    this.growing(() => this.list.append(item));
  }

  /** Keeps the first `count` lines and puts `items` after them. */
  replaceAfter(count: number, items: HTMLLIElement[]): void {
    this.growing(() => {
      [...this.list.children].slice(count).forEach((node) => node.remove());
      this.list.append(...items);
    });
  }

  /** Adds `node` at the end of the line `entryId`, if that line is shown. */
  appendToEntry(entryId: number, node: HTMLElement): void {
    this.growing(() => this.list.querySelector(`[data-entry="${entryId}"]`)?.append(node));
  }

  removeAll(selector: string): void {
    this.list.querySelectorAll(selector).forEach((node) => node.remove());
  }

  /** Swaps the newest line for a new version of it, e.g. a folded run that grew by one. */
  replaceLast(item: HTMLLIElement): void {
    const last = this.list.lastElementChild;
    if (last) last.replaceWith(item);
    else this.append(item);
  }

  /** Scrolls to the first of these assistant lines and marks them for a few seconds. */
  highlight(entryIds: number[]): void {
    const items = entryIds.flatMap((id) => [...this.list.querySelectorAll<HTMLElement>(`[data-entry="${id}"]`)]);
    items[0]?.scrollIntoView({ behavior: "smooth", block: "center" });
    for (const item of items) {
      item.classList.add("highlighted");
      setTimeout(() => item.classList.remove("highlighted"), HIGHLIGHT_MS);
    }
  }

  /** Keeps the newest lines in view while the list grows, if you were reading them. */
  private growing(grow: () => void): void {
    const atBottom = this.wrap.scrollHeight - this.wrap.scrollTop - this.wrap.clientHeight < STICK_TO_BOTTOM_PX;
    grow();
    if (atBottom) this.wrap.scrollTop = this.wrap.scrollHeight;
  }
}
