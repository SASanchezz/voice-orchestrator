// What the All chats view asks the server: every messenger's chats, one chat's latest messages, a message's file,
// a task drafted from messages, and sending what you wrote.

import type { BrowsedMessageView, SavedFileView, SourceChatsView, TaskDraftView } from "../chat-browse-views.js";
import { post, replyOf, urlOf } from "./api.js";

const NO_PARAMS = {};
const SAVED_FILE_PATH = "/api/chats/saved-file";

/** An open chat, as the server addresses it. */
export interface ChatAddress {
  source: string;
  chatId: string;
  chatName: string;
}

export async function fetchAllChats(): Promise<SourceChatsView[]> {
  return replyOf<SourceChatsView[]>(await fetch(urlOf("/api/chats", NO_PARAMS)));
}

export async function fetchBrowsedMessages(chat: ChatAddress): Promise<BrowsedMessageView[]> {
  return replyOf<BrowsedMessageView[]>(await fetch(urlOf(`${chatPath(chat)}/messages`, NO_PARAMS)));
}

/** Downloads the file into the attachments folder (once) and says where it is. */
export async function fetchSavedFile(chat: ChatAddress, messageId: string, fileId: string): Promise<SavedFileView> {
  const path = `${chatPath(chat)}/files/${encodeURIComponent(messageId)}/${encodeURIComponent(fileId)}`;
  return replyOf<SavedFileView>(await fetch(urlOf(path, NO_PARAMS)));
}

/** The downloaded file as a blob of its real type, for the page to play or show. */
export async function fetchFileBlob(saved: SavedFileView): Promise<Blob> {
  const res = await fetch(urlOf(SAVED_FILE_PATH, { path: saved.path }));
  if (!res.ok) throw new Error(res.statusText);
  return new Blob([await res.arrayBuffer()], { type: saved.mimeType });
}

/** Downloads the messages' files too, so it can take a while for a video. */
export async function fetchTaskDraft(chat: ChatAddress, messageIds: string[]): Promise<TaskDraftView> {
  const params = { chat: chat.chatName, messages: messageIds.join(",") };
  return replyOf<TaskDraftView>(await fetch(urlOf(`${chatPath(chat)}/task-draft`, params)));
}

/** Throws with the messenger's reason when it can't be sent. */
export async function sendChatMessage(chat: ChatAddress, text: string): Promise<string | undefined> {
  return post(`${chatPath(chat)}/send`, { text });
}

function chatPath({ source, chatId }: ChatAddress): string {
  return `/api/chats/${encodeURIComponent(source)}/${encodeURIComponent(chatId)}`;
}
