// Shared by the server and the web page: files and folders pasted into the message box go with the message as their
// paths, listed in a note the worker reads and the page reads back to show them as chips. No runtime imports, so the
// page bundles it and Node tests it.

const REFERENCE_NOTE_HEADER = "Referenced paths:";
const NOTE_LINE = /^- (\/.*)$/;
/** A folder's line ends in a slash, so the worker and the page can tell it from a file. */
const FOLDER_MARK = "/";

/** A file or folder on this Mac, copied in Finder or VS Code's Explorer. */
export interface ReferencedPath {
  path: string;
  isFolder: boolean;
}

/** A message apart from its reference note, and the paths the note lists. */
export interface ReferencingMessage {
  text: string;
  paths: ReferencedPath[];
}

/** Your message with the pasted paths listed after it. */
export function withReferenceNote(text: string, paths: ReferencedPath[]): string {
  if (!paths.length) return text;
  const note = [REFERENCE_NOTE_HEADER, ...paths.map(noteLine)].join("\n");
  return text ? `${text}\n\n${note}` : note;
}

function noteLine({ path, isFolder }: ReferencedPath): string {
  const marked = isFolder && !path.endsWith(FOLDER_MARK);
  return `- ${marked ? path + FOLDER_MARK : path}`;
}

/** Splits off the note at the end of a message; a message without one comes back whole. */
export function readReferenceNote(message: string): ReferencingMessage {
  const start = noteStart(message);
  if (start === undefined) return { text: message, paths: [] };
  const lines = message.slice(start + REFERENCE_NOTE_HEADER.length + 1).split("\n");
  const paths = lines.flatMap(referencedPath);
  if (paths.length !== lines.length) return { text: message, paths: [] };
  return { text: message.slice(0, start).trimEnd(), paths };
}

/** The note opens the message, or follows its text after a blank line. */
function noteStart(message: string): number | undefined {
  if (message.startsWith(`${REFERENCE_NOTE_HEADER}\n`)) return 0;
  const after = message.lastIndexOf(`\n\n${REFERENCE_NOTE_HEADER}\n`);
  return after === -1 ? undefined : after + "\n\n".length;
}

function referencedPath(line: string): ReferencedPath[] {
  const match = NOTE_LINE.exec(line);
  if (!match) return [];
  const isFolder = match[1].length > 1 && match[1].endsWith(FOLDER_MARK);
  return [{ path: isFolder ? match[1].slice(0, -1) : match[1], isFolder }];
}

/** The last part of the path: the file's or folder's own name. */
export function nameOf(path: string): string {
  const trimmed = path.endsWith(FOLDER_MARK) ? path.slice(0, -1) : path;
  return trimmed.slice(trimmed.lastIndexOf("/") + 1) || path;
}
