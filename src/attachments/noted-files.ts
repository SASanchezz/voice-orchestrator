// Shared by the server and the web page: the server lists attached files after a message, the page reads the list
// back to show the files instead of their paths. No runtime imports, so the page bundles it and Node tests it.

export const ATTACHMENT_NOTE_HEADER = "Attached files:";
/** "- /…/state/attachments/<id>/shot.png (2.5 MB)", as the note writes each file. */
const NOTE_LINE = /^- (.+\/([^/]+)) \(([\d.]+ [KM]B)\)$/;

export interface NotedFile {
  path: string;
  name: string;
  /** As people say it: "2.5 MB". */
  size: string;
}

/** A message apart from its attachment note, and the files the note lists. */
export interface NotedMessage {
  text: string;
  files: NotedFile[];
}

/** Splits off the note the server puts at the end of a message; a message without one comes back whole. */
export function readAttachmentNote(message: string): NotedMessage {
  const start = noteStart(message);
  if (start === undefined) return { text: message, files: [] };
  const lines = message.slice(start + ATTACHMENT_NOTE_HEADER.length + 1).split("\n");
  const files = lines.flatMap(notedFile);
  if (files.length !== lines.length) return { text: message, files: [] };
  return { text: message.slice(0, start).trimEnd(), files };
}

/** The note opens the message, or follows its text after a blank line. */
function noteStart(message: string): number | undefined {
  if (message.startsWith(`${ATTACHMENT_NOTE_HEADER}\n`)) return 0;
  const after = message.lastIndexOf(`\n\n${ATTACHMENT_NOTE_HEADER}\n`);
  return after === -1 ? undefined : after + "\n\n".length;
}

function notedFile(line: string): NotedFile[] {
  const match = NOTE_LINE.exec(line);
  return match ? [{ path: match[1], name: match[2], size: match[3] }] : [];
}
