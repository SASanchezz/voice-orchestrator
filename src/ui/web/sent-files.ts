// The files sent with a message, in its chat bubble instead of their paths: images as thumbnails that open larger,
// other files as chips with their name and size.

import { imageTypeOf } from "../../attachments/image-types.js";
import type { NotedFile } from "../../attachments/noted-files.js";
import { attachedImageUrl } from "./api.js";
import { el } from "./dom.js";
import { showImage } from "./image-viewer.js";

export function sentFiles(files: NotedFile[]): HTMLUListElement {
  return el("ul", { class: "sent-files", "aria-label": "Attached files" }, ...files.map(sentFile));
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
