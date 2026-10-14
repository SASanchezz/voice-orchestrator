// A picture attached to a message or the draft, shown large over the page; Escape or a click beside it closes it.

import { byId } from "./dom.js";

export function wireImageViewer(): void {
  const viewer = byId("image-viewer", HTMLDialogElement);
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) viewer.close();
  });
}

export function showImage(url: string, name: string): void {
  const image = byId("image-viewer-image", HTMLImageElement);
  image.src = url;
  image.alt = name;
  byId("image-viewer-name", HTMLElement).textContent = name;
  byId("image-viewer", HTMLDialogElement).showModal();
}
