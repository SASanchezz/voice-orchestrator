import type { AttachmentFiles, SavedAttachment } from "../../attachments/attachment-files.js";
import { MAX_ATTACHMENT_BYTES } from "../../attachments/attachment-limits.js";
import { readableSize } from "../../attachments/file-size.js";
import type { ClipboardSource, CopiedContent, CopiedImage } from "../../clipboard/clipboard-source.js";
import { defineTool, text, type OperatorTool, type ToolContent, type ToolResult } from "./tool-kit.js";

const IMAGE_FILE_NAME = "clipboard.png";
const TEXT_FILE_NAME = "clipboard.txt";
/** Longer copied text is saved as a file, so a worker's instruction carries its path instead of all of it. */
const MAX_INLINE_TEXT_CHARS = 4000;
const TEXT_BEGINNING_CHARS = 500;
const NOTHING_COPIED =
  "The clipboard holds no image, text or files. If the user did copy something, macOS may have refused the read: " +
  "they can allow pasting for their terminal app in System Settings > Privacy & Security.";

export function readClipboard(clipboard: ClipboardSource, attachments: AttachmentFiles): OperatorTool {
  return defineTool({
    name: "read_clipboard",
    description:
      "Read what the user copied: an image, a link or other text, or files copied in Finder. Copied images and long " +
      "text are saved as files whose paths a worker can open. Call only when the user asks about their clipboard or " +
      "what they copied.",
    args: {},
    run: async () => clipboardReport(await clipboard.read(), attachments),
  });
}

function clipboardReport(copied: CopiedContent, attachments: AttachmentFiles): ToolResult {
  if (copied.files?.length) return text(filesReport(copied.files));
  const content: ToolContent[] = [];
  if (copied.image) content.push(...imageReport(copied.image, attachments));
  if (copied.text) content.push(textReport(copied.text, attachments));
  return content.length ? { content } : text(NOTHING_COPIED);
}

function filesReport(paths: string[]): string {
  const lines = paths.map((path) => `- ${path}`);
  return ["The clipboard holds files copied in Finder:", ...lines].join("\n");
}

function imageReport(image: CopiedImage, attachments: AttachmentFiles): ToolContent[] {
  const saved = saveCopied(attachments, IMAGE_FILE_NAME, Buffer.from(image.png, "base64"));
  const caption =
    `The clipboard holds an image, saved as ${saved.path} (${readableSize(saved.size)}). ` +
    "Below is a smaller copy for you to look at; give a worker the saved path.";
  return [
    { type: "text", text: caption },
    { type: "image", data: image.preview, mimeType: "image/jpeg" },
  ];
}

function textReport(copied: string, attachments: AttachmentFiles): ToolContent {
  if (copied.length <= MAX_INLINE_TEXT_CHARS)
    return { type: "text", text: `The clipboard holds this text:\n${copied}` };
  const saved = saveCopied(attachments, TEXT_FILE_NAME, Buffer.from(copied));
  const beginning = copied.slice(0, TEXT_BEGINNING_CHARS);
  const report = `The clipboard holds ${copied.length} characters of text, saved in full as ${saved.path}. It begins:`;
  return { type: "text", text: `${report}\n${beginning}` };
}

function saveCopied(attachments: AttachmentFiles, name: string, bytes: Buffer): SavedAttachment {
  if (bytes.length > MAX_ATTACHMENT_BYTES) {
    throw new Error(`What was copied is larger than the ${readableSize(MAX_ATTACHMENT_BYTES)} a saved file can be.`);
  }
  return attachments.save([{ name, bytes }])[0];
}
