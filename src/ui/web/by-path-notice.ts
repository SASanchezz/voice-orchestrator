// A line above the attached files when some are too large to upload: they go as their path on this Mac instead.

import { MAX_ATTACHMENT_BYTES } from "../../attachments/attachment-limits.js";
import { readableSize } from "../../attachments/file-size.js";
import { byId } from "./dom.js";

export class ByPathNotice {
  private line = byId("by-path-notice", HTMLElement);

  /** Hidden when every file is uploaded. */
  show(byPath: File[]): void {
    this.line.hidden = !byPath.length;
    this.line.textContent = byPath.length ? ByPathNotice.explanation(byPath) : "";
  }

  private static explanation(byPath: File[]): string {
    const names = byPath.map((file) => file.name).join(", ");
    const limit = readableSize(MAX_ATTACHMENT_BYTES);
    return (
      `Sorry, ${names} can't be uploaded: attachments are limited to ${limit}, and Claude can't take files this ` +
      "large anyway. The message will carry the path on this Mac instead, so a worker can open it from there."
    );
  }
}
