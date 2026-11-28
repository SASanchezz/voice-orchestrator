import type { AttachmentTray } from "./attachments.js";
import type { PathReferences } from "./path-references.js";

/** What goes with the next message besides its text: the attached files, and the pasted files and folders. */
export interface ComposerAttachments {
  files: AttachmentTray;
  paths: PathReferences;
}
