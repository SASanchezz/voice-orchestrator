// Shared by the server and the web page.

const KIB = 1024;
const MIB = KIB * KIB;

/** A file's size as people say it: "340 KB", "2.4 MB". */
export function readableSize(bytes: number): string {
  if (bytes >= MIB) return `${(bytes / MIB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / KIB))} KB`;
}
