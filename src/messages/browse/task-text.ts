import { withAttachmentNote } from "../../attachments/attachment-note.js";
import type { SavedAttachment } from "../../attachments/attachment-files.js";
import type { BrowsedMessageView } from "../../ui/chat-browse-views.js";
import { MAX_DESCRIPTION_CHARS } from "../../ui/server/todo-item-body.js";
import { formatWhen } from "../../ui/when.js";

/** Shorter than the to-do list allows, so the title reads as one line. */
const MAX_TITLE_CHARS = 120;
const CUT_MARK = "…";
const NO_TEXT = "(no text)";

/** What a task made from messages says, and where the messages were. */
export interface TaskSource {
  /** e.g. "Telegram › Family". */
  where: string;
  chatName: string;
  messages: BrowsedMessageView[];
  /** Notes on files that couldn't be attached. */
  missingFiles: string[];
}

/** One message: who said what. Several: the chat, how many, and who wrote them. */
export function taskTitle({ chatName, messages }: TaskSource): string {
  if (messages.length === 1) return cutTo(`${messages[0].from}: ${firstLineOf(messages[0])}`, MAX_TITLE_CHARS);
  const senders = [...new Set(messages.map((message) => message.from))].join(", ");
  return cutTo(`${chatName}: ${messages.length} messages from ${senders}`, MAX_TITLE_CHARS);
}

/** Where they were, each message with its sender and time, then the attached files, all within the to-do's length. */
export function taskDescription(source: TaskSource, saved: SavedAttachment[]): string {
  const note = withAttachmentNote("", saved);
  const room = MAX_DESCRIPTION_CHARS - note.length - 2;
  const quoted = [`From ${source.where}:`, ...source.messages.map(messageBlock), ...source.missingFiles];
  const text = cutTo(quoted.join("\n\n"), room);
  return note ? `${text}\n\n${note}` : text;
}

function messageBlock(message: BrowsedMessageView): string {
  const files = message.files.map((file) => `[file: ${file.name}]`);
  const lines = [`${message.from}, ${formatWhen(new Date(message.sentAt), new Date())}:`, message.text, ...files];
  return lines.filter(Boolean).join("\n");
}

function firstLineOf({ text, files }: BrowsedMessageView): string {
  const firstLine = text.split("\n").find((line) => line.trim());
  return firstLine?.trim() ?? files[0]?.name ?? NO_TEXT;
}

function cutTo(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - CUT_MARK.length)}${CUT_MARK}`;
}
