import { z } from "zod";

const copiedImageSchema = z.object({
  /** The image as copied, base64 PNG. */
  png: z.string(),
  /** A smaller base64 JPEG of it, for the model to look at. */
  preview: z.string(),
});

/** What the clipboard holds: files copied in Finder, or an image and/or text; empty when nothing usable. */
export const copiedContentSchema = z.object({
  files: z.array(z.string()).optional(),
  image: copiedImageSchema.optional(),
  text: z.string().optional(),
});

export type CopiedImage = z.infer<typeof copiedImageSchema>;
export type CopiedContent = z.infer<typeof copiedContentSchema>;

/** The user's clipboard, read only when they ask for it. */
export interface ClipboardSource {
  read(): Promise<CopiedContent>;
}
