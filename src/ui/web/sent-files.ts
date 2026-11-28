// The files sent with a message, in its chat bubble instead of their paths: images as thumbnails that open larger,
// other files as chips with their name and size, and pasted files and folders as chips with their icon and name.

import { imageTypeOf } from "../../attachments/image-types.js";
import type { NotedFile } from "../../attachments/noted-files.js";
import type { ReferencedPath } from "../../attachments/referenced-paths.js";
import { attachedImageUrl } from "./api.js";
import { referenceLabel } from "./attachment-chips.js";
import { el } from "./dom.js";
import { showImage } from "./image-viewer.js";

export function sentFiles(files: NotedFile[]): HTMLUListElement {
  return el("ul", { class: "sent-files", "aria-label": "Attached files" }, ...files.map(sentFile));
}

/** The files and folders pasted into the message, which went as their paths. */
export function sentReferences(paths: ReferencedPath[]): HTMLUListElement {
  const chips = paths.map((item) => el("li", { class: "attachment reference" }, ...referenceLabel(item)));
  return el("ul", { class: "sent-files", "aria-label": "Referenced files and folders" }, ...chips);
}

function sentFile(file: NotedFile): HTMLLIElement {
  return imageTypeOf(file.name) ? imageThumbnail(file) : fileChip(file);
}

/** An image deleted after its week turns into a chip. */
function imageThumbnail(file: NotedFile): HTMLLIElement {
  const url = attachedImageUrl(file.path);
  const image = el("img", { class: "sent-thumb", src: url, alt: file.name, loading: "lazy" });
  const open = el("button", { type: "button", class: "sent-image", title: `${file.name} · ${file.size}` }, image);
  open.addEventListener("click", () => showImage(url, file.name));
  const item = el("li", {}, open);
  image.addEventListener("error", () => item.replaceWith(fileChip(file)), { once: true });
  return item;
}

function fileChip(file: NotedFile): HTMLLIElement {
  const name = el("span", { class: "attachment-name", title: file.name }, file.name);
  return el("li", { class: "attachment" }, name, el("span", { class: "attachment-size" }, file.size));
}
