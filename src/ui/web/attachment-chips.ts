// One chip per attached file: a thumbnail for images that opens larger, the name and size, and × to take it off.

import { readableSize } from "../../attachments/file-size.js";
import { button, el } from "./dom.js";
import { showImage } from "./image-viewer.js";

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
