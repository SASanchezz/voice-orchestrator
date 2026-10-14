import type { AttachmentFiles, SavedAttachment } from "../../attachments/attachment-files.js";
import { withAttachmentNote } from "../../attachments/attachment-note.js";
import { decodeUploads, type attachmentsField } from "./attachment-body.js";
import { attachedFilesBody, messageBody, taskBody } from "./request-body.js";
import type { z } from "zod";

/** A message or task typed in the page, with any attached files saved and listed after its text. */
export class AttachedText {
  constructor(private files: AttachmentFiles) {}

  message(body: unknown): string {
    const { text, attachments } = messageBody.parse(body);
    return this.attach(text, attachments);
  }

  instruction(body: unknown): string {
    const { instruction, attachments } = taskBody.parse(body);
    return this.attach(instruction, attachments);
  }

  /** Only files, for the voice message they go with. */
  savedFiles(body: unknown): SavedAttachment[] {
    return this.files.save(decodeUploads(attachedFilesBody.parse(body).attachments));
  }

  private attach(text: string, attachments: z.infer<typeof attachmentsField>): string {
    return withAttachmentNote(text, this.files.save(decodeUploads(attachments)));
  }
}
