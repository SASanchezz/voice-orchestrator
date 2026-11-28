// One chip per attached file: a thumbnail for images that opens larger, the name and size, and × to take it off.
// A pasted file or folder, which goes by its path, gets a chip with its icon and name.

import { readableSize } from "../../attachments/file-size.js";
import { nameOf, type ReferencedPath } from "../../attachments/referenced-paths.js";
import { button, el } from "./dom.js";
import { showImage } from "./image-viewer.js";

const FOLDER_ICON = "📁";
const FILE_ICON = "📄";

/** Thumbnails for attached images; each is released when its file leaves the tray. */
export class ImagePreviews {
  private urls = new Map<File, string>();

  thumbnail(file: File): Node | string {
    if (!file.type.startsWith("image/")) return "";
    const url = this.urls.get(file) ?? URL.createObjectURL(file);
    this.urls.set(file, url);
    const preview = el("button", { type: "button", class: "attachment-preview", title: `Show ${file.name}` });
    preview.append(el("img", { class: "attachment-thumb", src: url, alt: "" }));
    preview.addEventListener("click", () => showImage(url, file.name));
    return preview;
  }

  release(file: File): void {
    const url = this.urls.get(file);
    if (url) URL.revokeObjectURL(url);
    this.urls.delete(file);
  }
}

export function attachmentChip(file: File, thumbnail: Node | string, onRemove: () => void): HTMLLIElement {
  const remove = button("×", "ghost attachment-remove", onRemove);
  remove.title = `Remove ${file.name}`;
  const name = el("span", { class: "attachment-name", title: file.name }, file.name);
  const size = el("span", { class: "attachment-size" }, readableSize(file.size));
  return el("li", { class: "attachment" }, thumbnail, name, size, remove);
}

/** A pasted file or folder in the box: its icon and name, the full path on hover, and × to take it off. */
export function referenceChip(item: ReferencedPath, onRemove: () => void): HTMLLIElement {
  const remove = button("×", "ghost attachment-remove", onRemove);
  remove.title = `Remove ${nameOf(item.path)}`;
  return el("li", { class: "attachment reference" }, ...referenceLabel(item), remove);
}

/** A referenced path's icon and name, in the box and in a sent message's bubble. */
export function referenceLabel({ path, isFolder }: ReferencedPath): HTMLSpanElement[] {
  const icon = el("span", { class: "reference-icon", "aria-hidden": "true" }, isFolder ? FOLDER_ICON : FILE_ICON);
  return [icon, el("span", { class: "attachment-name", title: path }, nameOf(path))];
}

/** The chip of a file too large to upload, which goes as its path on this Mac. */
export function markSentByPath(chip: HTMLLIElement): void {
  chip.classList.add("by-path");
  const tag = el("span", { class: "attachment-by-path" }, "path only");
  chip.insertBefore(tag, chip.lastChild); // before ×
}
