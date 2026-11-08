// What the Review view leaves out of its file lists and diffs, and what it says instead.

import type { FileDiffView } from "../ui/change-views.js";
import { MAX_FILE_BYTES } from "./file-lines.js";

/** Beyond these, the list and a diff would only slow the page down; VS Code still opens them. */
export const MAX_LISTED_FILES = 300;
export const MAX_PATCH_BYTES = MAX_FILE_BYTES;

export const SECRET_NOT_SHOWN = "This looks like a secrets file, so its diff isn't shown here.";
export const TOO_LARGE_NOT_SHOWN = "This diff is too large to show here.";

export function notShown(path: string, notShownReason: string): FileDiffView {
  return { path, patch: "", notShownReason };
}
