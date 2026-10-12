// Folder paths short enough for one line of the project list. No imports, so the page bundles it and Node tests it.

const SHORT_FOLDER_CHARS = 34;

/** Keeps the end, where the project's own folder is: "~/Desktop/Work/client/repos/web" → "…/Work/client/repos/web". */
export function shortFolder(path: string, maxChars = SHORT_FOLDER_CHARS): string {
  if (path.length <= maxChars) return path;
  const parts = path.split("/");
  while (parts.length > 1 && `…/${parts.join("/")}`.length > maxChars) parts.shift();
  return `…/${parts.join("/")}`;
}
