// The Messages view's All chats: every Slack and Telegram DM, group and channel, read straight from the messengers
// when it opens. Picking a chat shows its latest messages, with their files; any message, or several picked at once,
// can be made into a to-do item, and you can write in the chat. Nothing is marked read or stored.

import type { BrowsedChatView, SourceChatsView } from "../chat-browse-views.js";
import { openBrowsedChat, showNote, wireBrowsedChat } from "./browsed-chat.js";
import { fetchAllChats } from "./chat-browse-api.js";
import { byId, el } from "./dom.js";

const KIND_LABELS: Record<BrowsedChatView["kind"], string> = {
  dm: "DM",
  "group-dm": "group DM",
  group: "group",
  channel: "channel",
};
const NO_MESSENGERS = "No Slack workspace or Telegram is set up yet: see ⚙ › Messengers.";

let sources: SourceChatsView[] = [];
/** The open chat, as source and chat ID, so it stays marked when the list is filtered. */
let selectedKey = "";

export function wireChatBrowser(): void {
  for (const opener of document.querySelectorAll(".all-chats-button")) opener.addEventListener("click", openBrowser);
  byId("chat-browser-back", HTMLButtonElement).addEventListener("click", closeBrowser);
  byId("chat-browser-refresh", HTMLButtonElement).addEventListener("click", () => void loadChats());
  byId("chat-browser-filter", HTMLInputElement).addEventListener("input", renderSources);
  wireBrowsedChat();
}

function openBrowser(): void {
  byId("chat-browser", HTMLElement).hidden = false;
  byId("chat-browser-filter", HTMLInputElement).focus();
  if (!sources.length) void loadChats();
}

function closeBrowser(): void {
  byId("chat-browser", HTMLElement).hidden = true;
}

async function loadChats(): Promise<void> {
  byId("chat-browser-sources", HTMLElement).replaceChildren(el("p", { class: "chat-browser-note" }, "Reading chats…"));
  try {
    sources = await fetchAllChats();
    renderSources();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    byId("chat-browser-sources", HTMLElement).replaceChildren(el("p", { class: "chat-browser-note" }, reason));
  }
}

function renderSources(): void {
  const list = byId("chat-browser-sources", HTMLElement);
  if (!sources.length) return list.replaceChildren(el("p", { class: "chat-browser-note" }, NO_MESSENGERS));
  const wanted = byId("chat-browser-filter", HTMLInputElement).value.trim().toLocaleLowerCase();
  list.replaceChildren(...sources.map((source) => sourceSection(source, wanted)));
  if (!selectedKey) showNote("Pick a chat to read its latest messages.");
}

function sourceSection(source: SourceChatsView, wanted: string): HTMLElement {
  const heading = el("h3", {}, source.label);
  if (source.problem) return el("section", { class: "chat-source" }, heading, problemLine(source.problem));
  const shown = source.chats.filter((chat) => chat.name.toLocaleLowerCase().includes(wanted));
  return el("section", { class: "chat-source" }, heading, ...shown.map((chat) => chatRow(source, chat)));
}

function problemLine(problem: string): HTMLElement {
  return el("p", { class: "chat-source-problem" }, problem);
}

function chatRow(source: SourceChatsView, chat: BrowsedChatView): HTMLElement {
  const row = el("button", { type: "button", class: "browsed-chat-row" }, ...rowParts(chat));
  row.classList.toggle("selected", keyOf(source, chat) === selectedKey);
  row.addEventListener("click", () => selectChat(source, chat));
  return row;
}

function rowParts(chat: BrowsedChatView): HTMLElement[] {
  const parts = [
    el("span", { class: "browsed-chat-name" }, chat.name),
    el("span", { class: "browsed-chat-kind" }, KIND_LABELS[chat.kind]),
  ];
  if (chat.unread) parts.push(el("span", { class: "browsed-chat-unread" }, String(chat.unread)));
  return parts;
}

function selectChat(source: SourceChatsView, chat: BrowsedChatView): void {
  selectedKey = keyOf(source, chat);
  renderSources();
  const { canSend, sendHint } = source;
  void openBrowsedChat({ source: source.source, chatId: chat.id, chatName: chat.name, canSend, sendHint });
}

function keyOf(source: SourceChatsView, chat: BrowsedChatView): string {
  return `${source.source}\n${chat.id}`;
}
