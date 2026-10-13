import type { IncomingMessage } from "node:http";
import { z } from "zod";
import { PERMISSION_MODES, SPEECH_MODES } from "../../config/app-config.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";

const MAX_BODY_BYTES = 65_536; // 64 KiB

export const messageBody = z.object({ text: z.string().trim().min(1) });
export const decisionBody = z.object({ decision: z.enum(["once", "always", "deny"]) });
export const answersBody = z.object({ answers: z.record(z.string(), z.string()) });
export const permissionModeBody = z.object({ mode: z.enum(PERMISSION_MODES) });
export const speechModeBody = z.object({ mode: z.enum(SPEECH_MODES) });
export const taskBody = z.object({ instruction: z.string().trim().min(1) });

/** A POST's JSON body; {} when it has none. */
export async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks = await readChunks(req);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(HTTP_STATUS.badRequest, "Body must be JSON");
  }
}

async function readChunks(req: IncomingMessage): Promise<Buffer[]> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<unknown>) {
    if (!(chunk instanceof Buffer)) continue;
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(HTTP_STATUS.tooLarge, "Request too large");
    chunks.push(chunk);
  }
  return chunks;
}
