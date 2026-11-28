// A paste of copied folders, or of anything copied in VS Code's Explorer, goes with the message as their paths. The
// page can read neither a folder nor VS Code's own clipboard type, so it asks the server, which reads the Mac's
// clipboard.

import type { ReferencedPath } from "../../attachments/referenced-paths.js";
import { replyOf, urlOf } from "./api.js";

/** Pasted files, or a paste that carries nothing the page can read, as VS Code's copies do. */
export function mayHoldCopiedPaths(pasted: DataTransfer): boolean {
  const carriesNothing = pasted.types.length === 0;
  return carriesNothing || pasted.files.length > 0;
}

/** What was copied in Finder or VS Code; none when the server can't tell, so the pasted files are attached instead. */
export async function fetchCopiedPaths(): Promise<ReferencedPath[]> {
  try {
    return await replyOf<ReferencedPath[]>(await fetch(urlOf("/api/clipboard/files", {})));
  } catch {
    return [];
  }
}

/** Folders can't be attached, and VS Code's copies give the page no files to attach. */
export function goesAsPaths(copied: ReferencedPath[], pastedFiles: File[]): boolean {
  const hasFolder = copied.some((item) => item.isFolder);
  return copied.length > 0 && (hasFolder || pastedFiles.length === 0);
}
