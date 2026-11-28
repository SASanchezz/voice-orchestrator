// The ways a file reaches the tray: the Attach button's picker, a drop anywhere on the chat, or a paste into the box.
// A pasted folder, or anything copied in VS Code's Explorer, goes to the box's path chips instead.

import type { AttachmentTray } from "./attachments.js";
import type { ComposerAttachments } from "./composer-attachments.js";
import { byId, bySelector } from "./dom.js";
import { fetchCopiedPaths, goesAsPaths, mayHoldCopiedPaths } from "./pasted-paths.js";

export function wireAttachmentInput(attachments: ComposerAttachments): void {
  wirePicker(attachments.files);
  keepPageOnStrayDrops();
  wireDropZone(attachments.files, bySelector(".center", HTMLElement));
  byId("composer-input", HTMLTextAreaElement).addEventListener("paste", (event) => {
    const pasted = event.clipboardData;
    if (!pasted || !mayHoldCopiedPaths(pasted)) return;
    event.preventDefault();
    void attachOrReferPaths([...pasted.files], attachments);
  });
}

/** Copied folders and VS Code's copies go as paths; other pasted files are attached. */
async function attachOrReferPaths(files: File[], { files: tray, paths }: ComposerAttachments): Promise<void> {
  const copied = await fetchCopiedPaths();
  if (goesAsPaths(copied, files)) paths.add(copied);
  else if (files.length) tray.add(files);
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
