import type { IncomingMessage } from "node:http";
import { z } from "zod";
import { MAX_ATTACHMENTS } from "../../attachments/attachment-limits.js";
import { PERMISSION_MODES, SPEECH_MODES } from "../../config/app-config.js";
import { attachmentsField } from "./attachment-body.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";

/** For every action without attachments. */
export const MAX_BODY_BYTES = 65_536; // 64 KiB
const NOTHING_TO_SEND = "Type a message or attach a file";
const MAX_PAGE_ID_LENGTH = 64;

export const messageBody = z
  .object({ text: z.string().trim(), attachments: attachmentsField })
  .refine((body) => body.text || body.attachments.length, NOTHING_TO_SEND);
export const decisionBody = z.object({ decision: z.enum(["once", "always", "deny"]) });
export const answersBody = z.object({ answers: z.record(z.string(), z.string()) });
export const permissionModeBody = z.object({ mode: z.enum(PERMISSION_MODES) });
export const speechModeBody = z.object({ mode: z.enum(SPEECH_MODES) });
export const taskBody = z
  .object({ instruction: z.string().trim(), attachments: attachmentsField })
  .refine((body) => body.instruction || body.attachments.length, NOTHING_TO_SEND);
export const queueRemovalBody = z.object({ place: z.number().int().positive(), instruction: z.string().min(1) });
export const attachedFilesBody = z
  .object({ attachments: attachmentsField })
  .refine((body) => body.attachments.length, "Attach a file");
export const draftBody = z.object({
  page: z.string().min(1).max(MAX_PAGE_ID_LENGTH),
  files: z.number().int().min(0).max(MAX_ATTACHMENTS),
});

/** A POST's JSON body; {} when it has none. */
export async function readJson(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks = await readChunks(req, maxBytes);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(HTTP_STATUS.badRequest, "Body must be JSON");
  }
}

async function readChunks(req: IncomingMessage, maxBytes: number): Promise<Buffer[]> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<unknown>) {
    if (!(chunk instanceof Buffer)) continue;
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(HTTP_STATUS.tooLarge, "Request too large");
    chunks.push(chunk);
  }
  return chunks;
}
