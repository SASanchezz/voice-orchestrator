// The chat's list on the page: replaced whole, or grown line by line while you read the newest lines.

import { byId, bySelector } from "./dom.js";

/** How close to the bottom counts as reading the newest messages, so new ones scroll into view. */
const STICK_TO_BOTTOM_PX = 40;

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
}
