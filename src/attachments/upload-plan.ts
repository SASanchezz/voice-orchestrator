// Shared by the server and the web page: an attached file too large to upload stays on this Mac, and the message
// carries its path instead. No runtime imports beyond the limits, so the page bundles it and Node tests it.

import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_TOTAL_BYTES } from "./attachment-limits.js";

export interface SizedFile {
  size: number;
}

/** The files sent by path: each over the per-file limit, or past the total once the files before it are counted. */
export function filesSentByPath<T extends SizedFile>(files: T[]): Set<T> {
  const byPath = new Set<T>();
  let uploaded = 0;
  for (const file of files) {
    const fits = file.size <= MAX_ATTACHMENT_BYTES && uploaded + file.size <= MAX_ATTACHMENTS_TOTAL_BYTES;
    if (fits) uploaded += file.size;
    else byPath.add(file);
  }
  return byPath;
}
