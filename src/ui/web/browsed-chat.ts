// The open chat in All chats: its latest messages, oldest at the top, read from the messenger each time it is opened
// and never stored; picking several for one task; and the box to write in it.

import type { BrowsedMessageView } from "../chat-browse-views.js";
import { messageCard } from "./browsed-message-card.js";
import { fetchBrowsedMessages } from "./chat-browse-api.js";
import { showComposerFor, wireChatComposer, type WritableChat } from "./chat-composer.js";
import { byId, el } from "./dom.js";
import { clearSelection, wireMessageSelection } from "./message-selection.js";
import { openTaskFrom } from "./message-task.js";

/** The chat last asked for; an older answer arriving late is dropped. */
let latestAsked: WritableChat | undefined;

export function wireBrowsedChat(): void {
  wireMessageSelection(makeTask);
  wireChatComposer(reloadOpenChat);
}

export async function openBrowsedChat(chat: WritableChat): Promise<void> {
  latestAsked = chat;
  clearSelection();
  byId("browsed-chat-title", HTMLElement).textContent = chat.chatName;
  showComposerFor(chat);
  showNote(`Reading ${chat.chatName}…`);
  await readInto(chat);
}

export function showNote(text: string): void {
  byId("browsed-messages", HTMLElement).replaceChildren(el("p", { class: "chat-browser-note" }, text));
}

/** After you send, the chat is read again so your message shows; what you picked stays picked. */
async function reloadOpenChat(): Promise<void> {
  if (latestAsked) await readInto(latestAsked);
}

async function readInto(chat: WritableChat): Promise<void> {
  try {
    const messages = await fetchBrowsedMessages(chat);
    if (latestAsked === chat) showMessages(messages, chat);
  } catch (error) {
    if (latestAsked === chat) showNote(error instanceof Error ? error.message : String(error));
  }
}

function showMessages(messages: BrowsedMessageView[], chat: WritableChat): void {
  if (!messages.length) return showNote("No messages here yet.");
  const list = byId("browsed-messages", HTMLElement);
  list.replaceChildren(...messages.map((message) => messageCard(message, chat, makeTask)));
  list.scrollTop = list.scrollHeight;
}

async function makeTask(messageIds: string[]): Promise<void> {
  if (latestAsked) await openTaskFrom(latestAsked, messageIds);
}
