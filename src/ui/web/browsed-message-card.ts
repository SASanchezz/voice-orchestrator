// One message in All chats: who and when, a box to pick it, Make task, its text and its files. A long press picks it;
// while messages are being picked, a click anywhere on one picks or unpicks it.

import type { BrowsedMessageView } from "../chat-browse-views.js";
import type { ChatAddress } from "./chat-browse-api.js";
import { el, formatWhen } from "./dom.js";
import { messageFiles } from "./message-files.js";
import { isPicked, isPicking, togglePicked } from "./message-selection.js";

const LONG_PRESS_MS = 450;

export function messageCard(
  message: BrowsedMessageView,
  chat: ChatAddress,
  makeTask: (messageIds: string[]) => Promise<void>,
): HTMLElement {
  const card = el("article", { class: "browsed-message", "data-message-id": message.id });
  card.append(metaLine(message, makeTask), el("p", { class: "browsed-message-text" }, message.text));
  card.append(...messageFiles(message, chat));
  card.classList.toggle("picked", isPicked(message.id));
  pickOnLongPress(card, message.id);
  return card;
}

function metaLine(message: BrowsedMessageView, makeTask: (messageIds: string[]) => Promise<void>): HTMLElement {
  const box = el("input", { type: "checkbox", class: "browsed-message-pick", title: "Select" });
  box.checked = isPicked(message.id);
  box.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePicked(message.id);
  });
  const makeOne = el("button", { type: "button", class: "make-task-button" }, "Make task");
  makeOne.addEventListener("click", (event) => {
    event.stopPropagation();
    void whilePreparing(makeOne, () => makeTask([message.id]));
  });
  const sender = el("span", { class: "browsed-message-from" }, message.from);
  const sentAt = el("time", { datetime: message.sentAt }, formatWhen(message.sentAt));
  return el("div", { class: "browsed-message-meta" }, box, sender, sentAt, makeOne);
}

/** Drafting downloads the message's files, which can take a while, so the button says so meanwhile. */
async function whilePreparing(button: HTMLButtonElement, work: () => Promise<void>): Promise<void> {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "Preparing…";
  await work();
  button.disabled = false;
  button.textContent = label;
}

/** A press held this long picks the message, and the click that ends it is then ignored. */
function pickOnLongPress(card: HTMLElement, messageId: string): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pressedLong = false;
  const cancel = (): void => clearTimeout(timer);
  card.addEventListener("pointerdown", () => {
    pressedLong = false;
    timer = setTimeout(() => {
      pressedLong = true;
      togglePicked(messageId);
    }, LONG_PRESS_MS);
  });
  for (const end of ["pointerup", "pointerleave", "pointercancel"]) card.addEventListener(end, cancel);
  card.addEventListener("click", () => {
    if (!pressedLong && isPicking()) togglePicked(messageId);
  });
}
