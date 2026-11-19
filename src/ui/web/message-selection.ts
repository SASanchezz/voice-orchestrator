// Picking several messages at once, as in Telegram: a long press (or the box on a message) starts picking, then a
// click picks or unpicks a message. The bar below the chat says how many and makes them into one task.

import { byId } from "./dom.js";

let picked = new Set<string>();
let onMakeTask: (messageIds: string[]) => Promise<void> = async () => {};

/** `makeTask` gets the picked messages; picking ends once their task's dialog is open. */
export function wireMessageSelection(makeTask: (messageIds: string[]) => Promise<void>): void {
  onMakeTask = makeTask;
  byId("selection-make-task", HTMLButtonElement).addEventListener("click", () => void makePickedTask());
  byId("selection-clear", HTMLButtonElement).addEventListener("click", clearSelection);
}

export function isPicking(): boolean {
  return picked.size > 0;
}

export function isPicked(messageId: string): boolean {
  return picked.has(messageId);
}

export function togglePicked(messageId: string): void {
  if (!picked.delete(messageId)) picked.add(messageId);
  renderSelection();
}

/** Opening another chat or making the task starts over. */
export function clearSelection(): void {
  picked = new Set();
  renderSelection();
}

async function makePickedTask(): Promise<void> {
  const button = byId("selection-make-task", HTMLButtonElement);
  button.disabled = true;
  button.textContent = "Preparing…";
  await onMakeTask([...picked]);
  button.disabled = false;
  clearSelection();
}

function renderSelection(): void {
  const list = byId("browsed-messages", HTMLElement);
  list.classList.toggle("selecting", isPicking());
  for (const card of list.querySelectorAll<HTMLElement>(".browsed-message")) markCard(card);
  byId("message-selection-bar", HTMLElement).hidden = !isPicking();
  byId("message-selection-count", HTMLElement).textContent = `${picked.size} selected`;
  byId("selection-make-task", HTMLButtonElement).textContent = picked.size > 1 ? "Make one task" : "Make task";
}

function markCard(card: HTMLElement): void {
  const isCardPicked = picked.has(card.dataset.messageId ?? "");
  card.classList.toggle("picked", isCardPicked);
  const box = card.querySelector<HTMLInputElement>(".browsed-message-pick");
  if (box) box.checked = isCardPicked;
}
