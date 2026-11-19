import type { AttachmentFiles, SavedAttachment } from "../../attachments/attachment-files.js";
import type { DiskFileFinder } from "../../attachments/disk-file-finder.js";
import type { QueuedTask } from "../../workers/queued-task.js";
import { withAttachmentNote } from "../../attachments/attachment-note.js";
import { decodeUploads, filesOnDisk, type attachmentsField } from "./attachment-body.js";
import { attachedFilesBody, messageBody, taskBody } from "./request-body.js";
import type { z } from "zod";

/**
 * A message or task typed in the page, with its attached files listed after its text: uploaded ones saved, ones too
 * large to upload found where they are on this Mac.
 */
export class AttachedText {
  constructor(
    private files: AttachmentFiles,
    private finder: DiskFileFinder,
  ) {}

  async message(body: unknown): Promise<string> {
    const { text, attachments } = messageBody.parse(body);
    return withAttachmentNote(text, await this.attached(attachments));
  }

  /** The task's text with its files, and the model it alone runs on if one was picked. */
  async task(body: unknown): Promise<QueuedTask> {
    const { instruction, attachments, model } = taskBody.parse(body);
    return { instruction: withAttachmentNote(instruction, await this.attached(attachments)), model };
  }

  /** Only files, for the voice message they go with. */
  savedFiles(body: unknown): Promise<SavedAttachment[]> {
    return this.attached(attachedFilesBody.parse(body).attachments);
  }

  /** Found first, so a file that can't be found saves nothing. */
  private async attached(attachments: z.infer<typeof attachmentsField>): Promise<SavedAttachment[]> {
    const found = await this.finder.findAll(filesOnDisk(attachments));
    return [...this.files.save(decodeUploads(attachments)), ...found];
  }
}
