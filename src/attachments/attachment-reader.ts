import { readFileSync, statSync } from "node:fs";
import { imageTypeOf } from "./image-types.js";

/** The API's limit for one image. */
const MAX_IMAGE_BYTES = 5_242_880; // 5 MiB
const MAX_TEXT_CHARS = 100_000;
/** A NUL byte this early means the file isn't text. */
const BINARY_SNIFF_BYTES = 8000;
const NUL_BYTE = 0;

export type AttachmentContent = { kind: "image"; data: string; mimeType: string } | { kind: "text"; text: string };

/** An attached file as the assistant can take it in: an image to look at, or its text. */
export function readAttachmentContent(path: string): AttachmentContent {
  const mimeType = imageTypeOf(path);
  return mimeType ? readImage(path, mimeType) : readText(path);
}

function readImage(path: string, mimeType: string): AttachmentContent {
  if (statSync(path).size > MAX_IMAGE_BYTES)
    throw new Error("The image is over 5 MB, too large to view here. A project worker can still open it by path.");
  return { kind: "image", data: readFileSync(path).toString("base64"), mimeType };
}

function readText(path: string): AttachmentContent {
  const bytes = readFileSync(path);
  if (bytes.subarray(0, BINARY_SNIFF_BYTES).includes(NUL_BYTE))
    throw new Error("This file isn't text or an image, so it can't be read here. Pass its path to a project worker.");
  const text = bytes.toString("utf8");
  if (text.length <= MAX_TEXT_CHARS) return { kind: "text", text };
  return {
    kind: "text",
    text: `${text.slice(0, MAX_TEXT_CHARS)}\n\n[cut off: the file has ${text.length} characters]`,
  };
}
