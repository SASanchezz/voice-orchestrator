// Confirm and Cancel under the assistant's open request for a confirm phrase, or Yes and Cancel under its go-ahead
// question. A click sends the words as your typed message, so the server checks them exactly as if you had said
// them, and nothing runs that the words wouldn't run. Like the talk key, a click cuts off the reply being said.

import {
  cancelWords,
  confirmWords,
  GO_AHEAD_CANCEL_WORDS,
  GO_AHEAD_YES_WORDS,
  openConfirmRequest,
  openGoAheadLineId,
} from "../confirm-request.js";
import type { FeedEntryView } from "../protocol.js";
import { act } from "./api.js";
import type { ChatList } from "./chat-list.js";
import { button, el } from "./dom.js";
import { store } from "./store.js";

const BAR_CLASS = "confirm-bar";

/** The buttons for what the server says the assistant asked for; none when it asked for nothing. */
export class ConfirmButtons {
  private entries: FeedEntryView[] = [];
  private shownAsk = "";

  /** Follows the page's state, so the buttons come and go with the server's request. */
  constructor(private list: ChatList) {
    store.onChange(() => this.showIfAskChanged());
  }

  /** Puts the buttons under the latest line of the assistant's chat, or takes them away once you have answered. */
  show(entries: FeedEntryView[]): void {
    this.entries = entries;
    this.shownAsk = currentAsk();
    this.list.removeAll(`.${BAR_CLASS}`);
    const { confirmVerbs, goAheadAsked } = store.state;
    const request = openConfirmRequest(entries, confirmVerbs);
    if (request) return this.list.appendToEntry(request.entryId, confirmBar(request.verbs));
    const goAheadLineId = openGoAheadLineId(entries, goAheadAsked);
    if (goAheadLineId !== undefined) this.list.appendToEntry(goAheadLineId, goAheadBar());
  }

  /** Rebuilt only on a new request, so buttons waiting on a click's send stay disabled. */
  private showIfAskChanged(): void {
    if (currentAsk() !== this.shownAsk) this.show(this.entries);
  }
}

/** One key for what the server currently asks, so a change in either kind of request redraws the buttons. */
function currentAsk(): string {
  const { confirmVerbs, goAheadAsked } = store.state;
  return `${confirmVerbs.join(" ")}|${goAheadAsked}`;
}

function confirmBar(verbs: string[]): HTMLDivElement {
  const bar = el("div", { class: BAR_CLASS });
  const confirms = verbs.map((verb) => {
    const confirm = button(`Confirm ${verb}`, "danger", () => void sendWords(bar, confirmWords(verb)));
    confirm.title = `Same as saying "${confirmWords(verb)}"`;
    return confirm;
  });
  const cancel = button("Cancel", "intent-dismiss", () => void sendWords(bar, cancelWords(verbs)));
  bar.append(...confirms, cancel);
  return bar;
}

function goAheadBar(): HTMLDivElement {
  const bar = el("div", { class: BAR_CLASS });
  const yes = button("Yes", "intent-allow", () => void sendWords(bar, GO_AHEAD_YES_WORDS));
  yes.title = `Same as saying "${GO_AHEAD_YES_WORDS}"`;
  const cancel = button("Cancel", "intent-dismiss", () => void sendWords(bar, GO_AHEAD_CANCEL_WORDS));
  cancel.title = `Same as saying "${GO_AHEAD_CANCEL_WORDS}"`;
  bar.append(yes, cancel);
  return bar;
}

/** The buttons wait while the words are on their way; a refused send lets you click again. */
async function sendWords(bar: HTMLDivElement, words: string): Promise<void> {
  const buttons = [...bar.querySelectorAll("button")];
  buttons.forEach((node) => (node.disabled = true));
  const sent = await act("/api/clicked-words", { text: words });
  if (sent === undefined) buttons.forEach((node) => (node.disabled = false));
}
