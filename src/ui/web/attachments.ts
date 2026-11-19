// Files attached to the next message: picked with Attach, dropped on the chat or pasted, listed as chips until sent.

import { MAX_ATTACHMENTS } from "../../attachments/attachment-limits.js";
import { filesSentByPath } from "../../attachments/upload-plan.js";
import { attachmentChip, ImagePreviews, markSentByPath } from "./attachment-chips.js";
import type { ByPathNotice } from "./by-path-notice.js";

/** A file uploaded with the message: its name and its bytes in base64. */
interface EncodedFile {
  name: string;
  data: string;
}

/** A file too large to upload, told by what the server needs to find its path on this Mac. */
interface FileOnDisk {
  name: string;
  size: number;
  modified: number;
}

/** A file as the server takes it. */
export type SentFile = EncodedFile | FileOnDisk;

export class AttachmentTray {
  private files: File[] = [];
  private previews = new ImagePreviews();

  /** `onChange` hears how many files are attached after each change. */
  constructor(
    private list: HTMLElement,
    private notice: ByPathNotice,
    private onChange: (files: number) => void,
  ) {}

  get isEmpty(): boolean {
    return !this.count;
  }

  get count(): number {
    return this.files.length;
  }

  /** Adds the files up to the count limit and says why any others were left out. */
  add(picked: Iterable<File>): void {
    const refusals: string[] = [];
    for (const file of picked) {
      const refusal = this.refusalFor(file);
      if (refusal) refusals.push(refusal);
      else this.files.push(file);
    }
    this.render();
    if (refusals.length) alert(refusals.join("\n"));
  }

  /** The files waiting to be sent, in the order they were attached. */
  get attached(): File[] {
    return [...this.files];
  }

  clear(): void {
    this.files.forEach((file) => this.previews.release(file));
    this.files = [];
    this.render();
  }

  private remove(file: File): void {
    this.previews.release(file);
    this.files = this.files.filter((kept) => kept !== file);
    this.render();
  }

  private refusalFor(file: File): string | undefined {
    if (this.files.length >= MAX_ATTACHMENTS) return `${file.name}: up to ${MAX_ATTACHMENTS} files per message.`;
    return undefined;
  }

  private render(): void {
    this.list.hidden = this.isEmpty;
    const byPath = filesSentByPath(this.files);
    this.list.replaceChildren(...this.files.map((file) => this.chipFor(file, byPath)));
    this.notice.show([...byPath]);
    this.onChange(this.count);
  }

  private chipFor(file: File, byPath: Set<File>): HTMLLIElement {
    const chip = attachmentChip(file, this.previews.thumbnail(file), () => this.remove(file));
    if (byPath.has(file)) markSentByPath(chip);
    return chip;
  }
}

/** The files as the server takes them, or undefined after telling you they couldn't be read. */
export async function encodeForSending(files: File[]): Promise<SentFile[] | undefined> {
  const byPath = filesSentByPath(files);
  const sent = await Promise.all(files.map((file) => sendable(file, byPath))).catch(() => undefined);
  if (!sent) alert("Couldn't read the attached files.");
  return sent;
}

function sendable(file: File, byPath: Set<File>): Promise<SentFile> {
  if (byPath.has(file)) return Promise.resolve({ name: file.name, size: file.size, modified: file.lastModified });
  return encode(file);
}

function encode(file: File): Promise<EncodedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve({ name: file.name, data: base64Of(reader.result) }));
    reader.addEventListener("error", () => reject(reader.error ?? new Error(`Can't read ${file.name}`)));
    reader.readAsDataURL(file);
  });
}

/** The base64 part of a data: URL. */
function base64Of(dataUrl: string | ArrayBuffer | null): string {
  if (typeof dataUrl !== "string") return "";
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}
