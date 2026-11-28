import type { IncomingMessage } from "node:http";
import { z } from "zod";
import { MAX_ATTACHMENTS } from "../../attachments/attachment-limits.js";
import { PERMISSION_MODES, SPEECH_MODES } from "../../config/app-config.js";
import { GESTURE_MODES } from "../../sensors/gesture-setting.js";
import { RECORDING_LABELS } from "../../wake/training-command.js";
import { RECORDING_NAME } from "../../wake/wake-recordings.js";
import { WAKE_WORD_MODES } from "../../wake/wake-setting.js";
import { WORKER_EFFORT_IDS } from "../../workers/worker-efforts.js";
import { WORKER_MODEL_IDS } from "../../workers/worker-models.js";
import { NOTICE_TARGETS } from "../notice-protocol.js";
import { attachmentsField } from "./attachment-body.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";

/** For every action without attachments. */
export const MAX_BODY_BYTES = 65_536; // 64 KiB
const NOTHING_TO_SEND = "Type a message or attach a file";
const MAX_PAGE_ID_LENGTH = 64;

export const messageBody = z
  .object({ text: z.string().trim(), attachments: attachmentsField })
  .refine((body) => body.text || body.attachments.length, NOTHING_TO_SEND);
/** A Confirm or Cancel click: the words it says for you. */
export const clickedWordsBody = z.object({ text: z.string().trim().min(1) });
export const decisionBody = z.object({ decision: z.enum(["once", "always", "deny"]) });
export const answersBody = z.object({ answers: z.record(z.string(), z.string()) });
export const permissionModeBody = z.object({ mode: z.enum(PERMISSION_MODES) });
export const speechModeBody = z.object({ mode: z.enum(SPEECH_MODES) });
export const gestureModeBody = z.object({ mode: z.enum(GESTURE_MODES) });
export const wakeWordModeBody = z.object({ mode: z.enum(WAKE_WORD_MODES) });
export const wakeRecordingBody = z.object({ label: z.enum(RECORDING_LABELS) });
/** One of your wake word training recordings. */
export const wakeRecordingFileBody = z.object({
  label: z.enum(RECORDING_LABELS),
  name: z.string().regex(RECORDING_NAME),
});
const MAX_DELETED_AT_ONCE = 500;
/** The recordings you marked in the review, deleted together. */
export const wakeRecordingsDeleteBody = z.object({
  recordings: z.array(wakeRecordingFileBody).min(1).max(MAX_DELETED_AT_ONCE),
});
export const noticeOpenBody = z.object({ view: z.enum(NOTICE_TARGETS) });
const modelField = z.enum(WORKER_MODEL_IDS);
/** With a model, only this task runs on it. */
export const taskBody = z
  .object({ instruction: z.string().trim(), attachments: attachmentsField, model: modelField.optional() })
  .refine((body) => body.instruction || body.attachments.length, NOTHING_TO_SEND);
/** No model: back to the project's. */
export const sessionModelBody = z.object({ model: modelField.optional() });
/** No effort: back to Claude Code's default. */
export const sessionEffortBody = z.object({ effort: z.enum(WORKER_EFFORT_IDS).optional() });
export const queueEditBody = z.object({ instruction: z.string().trim().min(1, "Write the task's instruction") });
export const attachedFilesBody = z
  .object({ attachments: attachmentsField })
  .refine((body) => body.attachments.length, "Attach a file");
const pageField = z.string().min(1).max(MAX_PAGE_ID_LENGTH);
export const draftBody = z.object({
  page: pageField,
  files: z.number().int().min(0).max(MAX_ATTACHMENTS),
});
/** A link clicked in a project's chat or notice; only web addresses, so no file or app opens. */
export const linkOpenBody = z.object({ url: z.url({ protocol: /^https?$/ }), project: z.string().min(1) });
/** No session: the page has the assistant, a project's To-do or Review on screen, or none at all. */
export const shownSessionBody = z.object({ page: pageField, session: z.string().min(1).optional() });
/** A page saying something about itself, such as that you came to it. */
export const pageBody = z.object({ page: pageField });
/** No session: another app or the assistant's tab is in front, or the page is closing. */
export const frontSessionBody = shownSessionBody;

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
