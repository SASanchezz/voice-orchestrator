import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

const RETENTION_MS = 604_800_000; // a week, so a task queued behind others can still read its files
const ID_BYTES = 4;
const MAX_NAME_LENGTH = 120;
const FALLBACK_NAME = "file";

/** A file attached in the web UI, as it arrived. */
export interface Upload {
  name: string;
  bytes: Buffer;
}

/** An attached file once it is on disk. */
export interface SavedAttachment {
  name: string;
  path: string;
  size: number;
}

/** Files attached in the web UI, each kept for a week in its own folder under state/attachments with its own name. */
export class AttachmentFiles {
  constructor(private dir: string) {}

  save(uploads: Upload[]): SavedAttachment[] {
    this.deleteExpired();
    return uploads.map((upload) => this.saveOne(upload));
  }

  /** The attached file at `path`; refuses anything outside the attachments folder. */
  require(path: string): string {
    const full = resolve(this.dir, path);
    if (!this.isSavedFile(full)) throw new Error(`No attached file at ${path}. Use the exact path from the message.`);
    return full;
  }

  /** Saved files sit one folder down: state/attachments/<id>/<name>. */
  private isSavedFile(full: string): boolean {
    const parts = relative(this.dir, full).split(sep);
    if (parts.length !== 2 || parts.includes("..")) return false;
    return existsSync(full) && statSync(full).isFile();
  }

  private saveOne({ name, bytes }: Upload): SavedAttachment {
    const folder = join(this.dir, `${Date.now()}-${randomBytes(ID_BYTES).toString("hex")}`);
    mkdirSync(folder, { recursive: true });
    const path = join(folder, safeFileName(name));
    writeFileSync(path, bytes, { mode: 0o600 });
    return { name: basename(path), path, size: bytes.length };
  }

  private deleteExpired(): void {
    if (!existsSync(this.dir)) return;
    const cutoff = Date.now() - RETENTION_MS;
    for (const entry of readdirSync(this.dir)) {
      const path = join(this.dir, entry);
      if (statSync(path).mtimeMs < cutoff) rmSync(path, { recursive: true, force: true });
    }
  }
}

/** The browser's file name without folders or characters that trouble a shell or a path. */
function safeFileName(name: string): string {
  const cleaned = basename(name)
    .replace(/[^\w.\- ]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  return cleaned.slice(-MAX_NAME_LENGTH) || FALLBACK_NAME;
}
