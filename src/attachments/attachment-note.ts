import type { SavedAttachment } from "./attachment-files.js";
import { readableSize } from "./file-size.js";
import { ATTACHMENT_NOTE_HEADER } from "./noted-files.js";

/** Your message with the saved files listed after it, so the assistant or a worker can open them by path. */
export function withAttachmentNote(text: string, saved: SavedAttachment[]): string {
  if (!saved.length) return text;
  const lines = saved.map((file) => `- ${file.path} (${readableSize(file.size)})`);
  const note = [ATTACHMENT_NOTE_HEADER, ...lines].join("\n");
  return text ? `${text}\n\n${note}` : note;
}
