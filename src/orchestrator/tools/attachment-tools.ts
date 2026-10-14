import { z } from "zod";
import type { AttachmentFiles } from "../../attachments/attachment-files.js";
import { readAttachmentContent } from "../../attachments/attachment-reader.js";
import { defineTool, text, type OperatorTool } from "./tool-kit.js";

export function readAttachment(files: AttachmentFiles): OperatorTool {
  return defineTool({
    name: "read_attachment",
    description:
      "Look at a file the user attached in the web UI: an image (png, jpg, gif, webp) or a text file. Only paths listed under 'Attached files:' work.",
    args: { path: z.string().describe("The file's full path, exactly as listed under 'Attached files:'") },
    run: ({ path }) => {
      const content = readAttachmentContent(files.require(path));
      if (content.kind === "text") return text(content.text);
      return { content: [{ type: "image", data: content.data, mimeType: content.mimeType }] };
    },
  });
}
