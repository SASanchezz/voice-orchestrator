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
    const atBottom = this.wrap.scrollHeight - this.wrap.scrollTop - this.wrap.clientHeight < STICK_TO_BOTTOM_PX;
    this.list.append(item);
    if (atBottom) this.wrap.scrollTop = this.wrap.scrollHeight;
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
}
