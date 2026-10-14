// The ways a file reaches the tray: the Attach button's picker, a drop anywhere on the chat, or a paste into the box.

import type { AttachmentTray } from "./attachments.js";
import { byId, bySelector } from "./dom.js";

export function wireAttachmentInput(tray: AttachmentTray): void {
  wirePicker(tray);
  keepPageOnStrayDrops();
  wireDropZone(tray, bySelector(".center", HTMLElement));
  byId("composer-input", HTMLTextAreaElement).addEventListener("paste", (event) => {
    const files = event.clipboardData?.files;
    if (!files?.length) return;
    event.preventDefault();
    tray.add(files);
  });
}

function wirePicker(tray: AttachmentTray): void {
  const picker = byId("attach-input", HTMLInputElement);
  byId("attach-button", HTMLButtonElement).addEventListener("click", () => picker.click());
  picker.addEventListener("change", () => {
    if (picker.files) tray.add(picker.files);
    picker.value = ""; // picking the same file again still fires change
  });
}

function wireDropZone(tray: AttachmentTray, zone: HTMLElement): void {
  zone.addEventListener("dragover", (event) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    zone.classList.add("dropping");
  });
  zone.addEventListener("dragleave", (event) => {
    if (!(event.relatedTarget instanceof Node) || !zone.contains(event.relatedTarget))
      zone.classList.remove("dropping");
  });
  zone.addEventListener("drop", (event) => {
    zone.classList.remove("dropping");
    if (!carriesFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) tray.add(event.dataTransfer.files);
  });
}

/** A file dropped beside the chat would otherwise make the browser leave the page to open it. */
function keepPageOnStrayDrops(): void {
  for (const type of ["dragover", "drop"] as const)
    window.addEventListener(type, (event) => {
      if (carriesFiles(event)) event.preventDefault();
    });
}

function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes("Files") ?? false;
}
