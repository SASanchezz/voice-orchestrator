// Shared by the server and the web page.

/** Image types Claude can see, and the page shows as pictures, by file extension. */
const IMAGE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

/** The image type of a file name or path, or undefined when it isn't one of those images. */
export function imageTypeOf(fileName: string): string | undefined {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? undefined : IMAGE_TYPES[fileName.slice(dot).toLowerCase()];
}
