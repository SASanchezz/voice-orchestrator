import { z } from "zod";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENTS_TOTAL_BYTES,
} from "../../attachments/attachment-limits.js";
import type { Upload } from "../../attachments/attachment-files.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";

const MAX_NAME_LENGTH = 255;
/** Base64 writes every 3 bytes as 4 characters. */
const BASE64_GROWTH = 1.34;
/** Room for the message's text and the JSON around the files. */
const BODY_SLACK_BYTES = 1_048_576; // 1 MiB

/** The largest request that carries attachments: every file at the total limit, base64-encoded. */
export const MAX_ATTACHED_BODY_BYTES = Math.ceil(MAX_ATTACHMENTS_TOTAL_BYTES * BASE64_GROWTH) + BODY_SLACK_BYTES;

const encodedFile = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  /** The file's bytes in base64. */
  data: z.string().base64(),
});

export const attachmentsField = z.array(encodedFile).max(MAX_ATTACHMENTS).default([]);

/** The files' bytes, within the size limits the page also checks. */
export function decodeUploads(files: z.infer<typeof attachmentsField>): Upload[] {
  const uploads = files.map(({ name, data }) => ({ name, bytes: Buffer.from(data, "base64") }));
  const oversized = uploads.find((upload) => upload.bytes.length > MAX_ATTACHMENT_BYTES);
  if (oversized) throw new HttpError(HTTP_STATUS.tooLarge, `${oversized.name} is over the per-file limit`);
  const total = uploads.reduce((sum, upload) => sum + upload.bytes.length, 0);
  if (total > MAX_ATTACHMENTS_TOTAL_BYTES) throw new HttpError(HTTP_STATUS.tooLarge, "Attachments are too large");
  return uploads;
}
