import { z } from "zod";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENTS_TOTAL_BYTES,
} from "../../attachments/attachment-limits.js";
import type { Upload } from "../../attachments/attachment-files.js";
import type { FileOnDisk } from "../../attachments/disk-file-finder.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";

const MAX_NAME_LENGTH = 255;
/** Base64 writes every 3 bytes as 4 characters. */
const BASE64_GROWTH = 1.34;
/** Room for the message's text and the JSON around the files. */
const BODY_SLACK_BYTES = 1_048_576; // 1 MiB

/** The largest request that carries attachments: every file at the total limit, base64-encoded. */
export const MAX_ATTACHED_BODY_BYTES = Math.ceil(MAX_ATTACHMENTS_TOTAL_BYTES * BASE64_GROWTH) + BODY_SLACK_BYTES;

const fileName = z.string().trim().min(1).max(MAX_NAME_LENGTH);

const encodedFile = z.object({
  name: fileName,
  /** The file's bytes in base64. */
  data: z.string().base64(),
});

/** Too large to upload, so only what finds it on this Mac; a name without folders. */
const fileOnDisk = z.object({
  name: fileName.refine((name) => !name.includes("/") && name !== "..", "A file name without folders"),
  size: z.number().int().positive(),
  modified: z.number().nonnegative(),
});

type EncodedFile = z.infer<typeof encodedFile>;
type AttachedFile = EncodedFile | FileOnDisk;

export const attachmentsField = z
  .array(z.union([encodedFile, fileOnDisk]))
  .max(MAX_ATTACHMENTS)
  .default([]);

/** The uploaded files' bytes, within the size limits the page also checks. */
export function decodeUploads(files: AttachedFile[]): Upload[] {
  const encoded = files.filter(isEncoded);
  const uploads = encoded.map(({ name, data }) => ({ name, bytes: Buffer.from(data, "base64") }));
  const oversized = uploads.find((upload) => upload.bytes.length > MAX_ATTACHMENT_BYTES);
  if (oversized) throw new HttpError(HTTP_STATUS.tooLarge, `${oversized.name} is over the per-file limit`);
  const total = uploads.reduce((sum, upload) => sum + upload.bytes.length, 0);
  if (total > MAX_ATTACHMENTS_TOTAL_BYTES) throw new HttpError(HTTP_STATUS.tooLarge, "Attachments are too large");
  return uploads;
}

/** The files the page sent by name, left on this Mac for their paths to be found. */
export function filesOnDisk(files: AttachedFile[]): FileOnDisk[] {
  return files.filter(isOnDisk);
}

function isEncoded(file: AttachedFile): file is EncodedFile {
  return "data" in file;
}

function isOnDisk(file: AttachedFile): file is FileOnDisk {
  return !isEncoded(file);
}
