// Files attached to the next message: picked with Attach, dropped on the chat or pasted, listed as chips until sent.

import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENTS_TOTAL_BYTES,
} from "../../attachments/attachment-limits.js";
import { readableSize } from "../../attachments/file-size.js";
import { attachmentChip, ImagePreviews } from "./attachment-chips.js";

/** A file as the server takes it: its name and its bytes in base64. */
export interface EncodedFile {
  name: string;
  data: string;
}

export class AttachmentTray {
  private files: File[] = [];
  private previews = new ImagePreviews();

  /** `onChange` hears how many files are attached after each change. */
  constructor(
    private list: HTMLElement,
    private onChange: (files: number) => void,
  ) {}

  get isEmpty(): boolean {
    return !this.count;
  }

  get count(): number {
    return this.files.length;
  }

  /** Adds the files within the limits and says why any others were left out. */
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
    if (file.size > MAX_ATTACHMENT_BYTES) return `${file.name}: over ${readableSize(MAX_ATTACHMENT_BYTES)}.`;
    const total = this.files.reduce((sum, kept) => sum + kept.size, file.size);
    if (total > MAX_ATTACHMENTS_TOTAL_BYTES)
      return `${file.name}: attachments can't add up to more than ${readableSize(MAX_ATTACHMENTS_TOTAL_BYTES)}.`;
    return undefined;
  }

  private render(): void {
    this.list.hidden = this.isEmpty;
    const chips = this.files.map((file) =>
      attachmentChip(file, this.previews.thumbnail(file), () => this.remove(file)),
    );
    this.list.replaceChildren(...chips);
    this.onChange(this.count);
  }
}

/** The files as the server takes them, or undefined after telling you they couldn't be read. */
export async function encodeForSending(files: File[]): Promise<EncodedFile[] | undefined> {
  const encoded = await Promise.all(files.map(encode)).catch(() => undefined);
  if (!encoded) alert("Couldn't read the attached files.");
  return encoded;
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
