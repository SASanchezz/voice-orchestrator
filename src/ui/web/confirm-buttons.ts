// Confirm and Cancel under the assistant's open request for a confirm phrase. A click sends the words as your typed
// message, so the server checks them exactly as if you had said them, and nothing runs that the words wouldn't run.

import { openConfirmRequest } from "../confirm-request.js";
import type { FeedEntryView } from "../protocol.js";
import { act } from "./api.js";
import type { ChatList } from "./chat-list.js";
import { button, el } from "./dom.js";

const BAR_CLASS = "confirm-bar";

/** Puts the buttons under the latest open request, or takes them away once you have answered it. */
export function showConfirmButtons(list: ChatList, entries: FeedEntryView[]): void {
  list.removeAll(`.${BAR_CLASS}`);
  const request = openConfirmRequest(entries);
  if (request) list.appendToEntry(request.entryId, confirmBar(request.verbs));
}

function confirmBar(verbs: string[]): HTMLDivElement {
  const bar = el("div", { class: BAR_CLASS });
  const confirms = verbs.map((verb) => {
    const confirm = button(`Confirm ${verb}`, "danger", () => void sendWords(bar, `confirm ${verb}`));
    confirm.title = `Same as saying "confirm ${verb}"`;
    return confirm;
  });
  const cancel = button("Cancel", "ghost", () => void sendWords(bar, `Cancel, don't ${verbs.join(" or ")}.`));
  bar.append(...confirms, cancel);
  return bar;
}

/** The buttons wait while the words are on their way; a refused send lets you click again. */
async function sendWords(bar: HTMLDivElement, words: string): Promise<void> {
  const buttons = [...bar.querySelectorAll("button")];
  buttons.forEach((node) => (node.disabled = true));
  const sent = await act("/api/message", { text: words });
  if (sent === undefined) buttons.forEach((node) => (node.disabled = false));
}
