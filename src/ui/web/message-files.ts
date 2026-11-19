// A message's photos, videos and files as chips. Clicking one downloads it into the attachments folder (where a task's
// worker can open it too) and shows it under the message: a picture, a player, or where it was saved.

import { readableSize } from "../../attachments/file-size.js";
import type { BrowsedFileView, BrowsedMessageView, SavedFileView } from "../chat-browse-views.js";
import { fetchFileBlob, fetchSavedFile, type ChatAddress } from "./chat-browse-api.js";
import { el } from "./dom.js";

const ICONS: Record<string, string> = { image: "🖼", video: "▶", audio: "♪" };
const FILE_ICON = "📎";
const SHOWN_KINDS = new Set(["image", "video", "audio"]);

/** The message's file chips with the place a chosen one is shown; nothing when it has no files. */
export function messageFiles(message: BrowsedMessageView, chat: ChatAddress): HTMLElement[] {
  if (!message.files.length) return [];
  const view = el("div", { class: "message-file-view" });
  const open = (file: BrowsedFileView): void => void showFile(view, () => fetchSavedFile(chat, message.id, file.id));
  const chips = message.files.map((file) => fileChip(file, () => open(file)));
  return [el("div", { class: "message-files" }, ...chips), view];
}

function fileChip(file: BrowsedFileView, open: () => void): HTMLButtonElement {
  const size = file.size ? ` (${readableSize(file.size)})` : "";
  const chip = el(
    "button",
    { type: "button", class: "message-file-chip" },
    `${iconOf(file.mimeType)} ${file.name}${size}`,
  );
  chip.addEventListener("click", (event) => {
    event.stopPropagation(); // a click on a file never picks the message
    open();
  });
  return chip;
}

async function showFile(view: HTMLElement, download: () => Promise<SavedFileView>): Promise<void> {
  view.replaceChildren(el("p", { class: "message-file-path" }, "Downloading…"));
  try {
    const saved = await download();
    view.replaceChildren(...(await previewOf(saved)), el("p", { class: "message-file-path" }, `Saved: ${saved.path}`));
  } catch (error) {
    view.replaceChildren(
      el("p", { class: "message-file-path" }, error instanceof Error ? error.message : String(error)),
    );
  }
}

/** Pictures, videos and sound play in the page; other files are only saved. */
async function previewOf(saved: SavedFileView): Promise<HTMLElement[]> {
  const kind = kindOf(saved.mimeType);
  if (!SHOWN_KINDS.has(kind)) return [];
  const source = URL.createObjectURL(await fetchFileBlob(saved));
  if (kind === "image") return [el("img", { src: source, alt: saved.name })];
  return [el(kind === "video" ? "video" : "audio", { src: source, controls: "" })];
}

function iconOf(mimeType: string): string {
  return ICONS[kindOf(mimeType)] ?? FILE_ICON;
}

function kindOf(mimeType: string): string {
  return mimeType.split("/")[0] ?? "";
}
