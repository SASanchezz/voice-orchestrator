// The Messages view: drafted Slack and Telegram replies, in place of the code and chat. The list on the left shows who
// is waiting, newest first; the selected reply opens on the right with its conversation and your draft. The top bar's
// Messages button shows how many wait. Drafts arrive without telling the page, so it asks every few seconds; a reply
// already shown is never rebuilt, so one you are editing or dictating stays as it is. After a reply is sent or
// dismissed, the next one is selected.

import type { ReplyDraftView } from "../reply-views.js";
import { byId } from "./dom.js";
import { wireDraftingToggle } from "./drafting-toggle.js";
import { fetchReplies } from "./reply-api.js";
import { ReplyCard } from "./reply-card.js";
import { checkSetupWhenStale } from "./reply-checkup.js";
import { wireReplyKeys } from "./reply-keys.js";
import { showReplyToast } from "./reply-toast.js";
import { store } from "./store.js";

const POLL_MS = 5_000;

let waiting: ReplyDraftView[] = [];
const cards = new Map<string, ReplyCard>();
let selectedId: string | undefined;
/** The draft the pop-up's Open asked for, selected once its card is there. */
let draftToSelect: string | undefined;

export function wireMessages(): void {
  byId("messages-button", HTMLButtonElement).addEventListener("click", toggleMessages);
  wireReplyKeys({ move: moveSelection, edit: () => selectedCard()?.edit() });
  wireDraftingToggle();
  void refreshReplies();
  setInterval(refreshWhileVisible, POLL_MS);
  document.addEventListener("visibilitychange", refreshWhileVisible);
}

/** From the pop-up's Open: the Messages view, with that draft selected. */
export function showDraft(draftId: string): void {
  draftToSelect = draftId;
  store.showMessages();
  void refreshReplies();
}

export function renderMessages(): void {
  renderButton();
  const panel = byId("messages-panel", HTMLElement);
  panel.hidden = !store.messagesShown;
  if (!store.messagesShown) return;
  checkSetupWhenStale();
  syncCards();
  panel.classList.toggle("empty", waiting.length === 0);
  byId("reply-count", HTMLElement).textContent = waiting.length ? String(waiting.length) : "";
}

function toggleMessages(): void {
  if (store.messagesShown) store.hideReview();
  else store.showMessages();
}

function refreshWhileVisible(): void {
  if (document.visibilityState === "visible") void refreshReplies();
}

async function refreshReplies(): Promise<void> {
  try {
    const next = await fetchReplies();
    if (JSON.stringify(next) === JSON.stringify(waiting)) return;
    waiting = next;
    store.rerender();
  } catch {
    // the server is restarting; the next poll catches up
  }
}

function renderButton(): void {
  const button = byId("messages-button", HTMLButtonElement);
  button.textContent = waiting.length ? `Messages ${waiting.length}` : "Messages";
  button.classList.toggle("shown", store.messagesShown);
}

/** New drafts go on top; sent and dismissed ones go; the rest keep their card, with their times brought up to date. */
function syncCards(): void {
  const ids = new Set(waiting.map((view) => view.id));
  const rows = [...byId("reply-rows", HTMLElement).children];
  const selectedIndex = rows.findIndex((row) => row === selectedCard()?.row); // as listed, newest first
  for (const [id, card] of cards) if (!ids.has(id)) removeCard(id, card);
  for (const view of waiting.toReversed()) showCard(view);
  selectAfterChange(selectedIndex);
}

function showCard(view: ReplyDraftView): void {
  const shown = cards.get(view.id);
  if (shown) return shown.update(view);
  const card = new ReplyCard(view, afterAction);
  card.row.addEventListener("click", () => select(view.id));
  cards.set(view.id, card);
  byId("reply-rows", HTMLElement).prepend(card.row);
  byId("reply-detail", HTMLElement).append(card.detail);
}

function removeCard(id: string, card: ReplyCard): void {
  card.remove();
  cards.delete(id);
  if (selectedId === id) selectedId = undefined;
}

/** The asked-for draft first; then the one already selected; else the one that took the gone one's place. */
function selectAfterChange(previousIndex: number): void {
  const asked = draftToSelect && cards.has(draftToSelect) ? draftToSelect : undefined;
  if (asked) draftToSelect = undefined;
  const inPlace = waiting[Math.min(Math.max(previousIndex, 0), waiting.length - 1)]?.id;
  const next = asked ?? selectedId ?? inPlace;
  if (next && next !== selectedId) select(next);
}

function select(id: string): void {
  selectedCard()?.deselect();
  selectedId = id;
  selectedCard()?.select();
}

function selectedCard(): ReplyCard | undefined {
  return selectedId ? cards.get(selectedId) : undefined;
}

function moveSelection(step: number): void {
  const index = waiting.findIndex((view) => view.id === selectedId);
  const next = waiting[Math.min(Math.max(index + step, 0), waiting.length - 1)];
  if (!next) return;
  select(next.id);
  selectedCard()?.row.focus();
}

/** What the server said about a click is shown briefly, since the reply it was about may go from the list. */
function afterAction(message: string): void {
  if (message) showReplyToast(message);
  void refreshReplies();
}
