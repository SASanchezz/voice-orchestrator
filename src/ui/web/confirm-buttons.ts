// Confirm and Cancel under the assistant's open request for a confirm phrase. A click sends the words as your typed
// message, so the server checks them exactly as if you had said them, and nothing runs that the words wouldn't run.

import { cancelWords, confirmWords, openConfirmRequest } from "../confirm-request.js";
import type { FeedEntryView } from "../protocol.js";
import { act } from "./api.js";
import type { ChatList } from "./chat-list.js";
import { button, el } from "./dom.js";
import { store } from "./store.js";

const BAR_CLASS = "confirm-bar";

/** The buttons for the verbs the server says the assistant asked for; none when it asked for none. */
export class ConfirmButtons {
  private entries: FeedEntryView[] = [];
  private shownVerbs: string[] = [];

  /** Follows the page's state, so the buttons come and go with the server's request. */
  constructor(private list: ChatList) {
    store.onChange(() => this.showIfAskChanged());
  }

  /** Puts the buttons under the latest line of the assistant's chat, or takes them away once you have answered. */
  show(entries: FeedEntryView[]): void {
    this.entries = entries;
    this.shownVerbs = store.state.confirmVerbs;
    this.list.removeAll(`.${BAR_CLASS}`);
    const request = openConfirmRequest(entries, this.shownVerbs);
    if (request) this.list.appendToEntry(request.entryId, confirmBar(request.verbs));
  }

  /** Rebuilt only on a new request, so buttons waiting on a click's send stay disabled. */
  private showIfAskChanged(): void {
    const asked = store.state.confirmVerbs.join(" ");
    if (asked !== this.shownVerbs.join(" ")) this.show(this.entries);
  }
}

function confirmBar(verbs: string[]): HTMLDivElement {
  const bar = el("div", { class: BAR_CLASS });
  const confirms = verbs.map((verb) => {
    const confirm = button(`Confirm ${verb}`, "danger", () => void sendWords(bar, confirmWords(verb)));
    confirm.title = `Same as saying "${confirmWords(verb)}"`;
    return confirm;
  });
  const cancel = button("Cancel", "ghost", () => void sendWords(bar, cancelWords(verbs)));
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
