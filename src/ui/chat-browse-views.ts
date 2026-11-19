// What the Messages view's All chats shows of every Slack and Telegram chat. No imports, so the page bundles it.

export type BrowsedChatKind = "dm" | "group-dm" | "group" | "channel";

/** A DM, group DM, group or channel, as listed by its messenger. */
export interface BrowsedChatView {
  id: string;
  name: string;
  kind: BrowsedChatKind;
  /** Unread messages, where the messenger says; 0 otherwise. */
  unread: number;
}

/** One source's chats; when it couldn't be read, no chats and the reason why. */
export interface SourceChatsView {
  /** The key the source's messages are read by, e.g. "slack:acme" or "telegram". */
  source: string;
  /** e.g. "Slack acme" or "Telegram". */
  label: string;
  chats: BrowsedChatView[];
  /** Empty when the source was read. */
  problem: string;
  /** Whether you can write in its chats from the app. */
  canSend: boolean;
  /** Why you can't, when you can't. */
  sendHint: string;
}

/** A message as the chat shows it; invisible characters and secrets are taken out. */
export interface BrowsedMessageView {
  id: string;
  from: string;
  /** ISO time. */
  sentAt: string;
  text: string;
  hasMedia: boolean;
  /** Photos, videos and files it carries; downloaded only when you open one or make a task. */
  files: BrowsedFileView[];
}

/** A file in a message, before it is downloaded. */
export interface BrowsedFileView {
  id: string;
  name: string;
  mimeType: string;
  /** Bytes; 0 when the messenger doesn't say. */
  size: number;
}

/** A message's file once it is downloaded into the attachments folder, where a task's worker can open it. */
export interface SavedFileView {
  name: string;
  path: string;
  size: number;
  mimeType: string;
}

/** A to-do item made from one or more messages, for you to edit before it is saved. */
export interface TaskDraftView {
  title: string;
  description: string;
}
