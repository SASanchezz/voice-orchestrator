import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { AttachmentFiles } from "../../attachments/attachment-files.js";
import { MAX_ATTACHMENT_BYTES } from "../../attachments/attachment-limits.js";
import type { CopiedContent } from "../../clipboard/clipboard-source.js";
import { TestClipboard } from "../../testing/test-clipboard.js";
import { readClipboard } from "./clipboard-tools.js";
import type { ToolResult } from "./tool-kit.js";

const dir = mkdtempSync(join(tmpdir(), "clipboard-tools-"));
after(() => rmSync(dir, { recursive: true, force: true }));

const PNG_BYTES = Buffer.from("fake png");
const PREVIEW = Buffer.from("fake jpeg").toString("base64");
const LONG_TEXT = "x".repeat(5000);

async function readCopied(copied: CopiedContent): Promise<ToolResult> {
  const clipboard = new TestClipboard();
  clipboard.copied = copied;
  return readClipboard(clipboard, new AttachmentFiles(dir)).call({});
}

function textOf(result: ToolResult): string {
  return result.content.map((part) => (part.type === "text" ? part.text : "")).join("\n");
}

function savedPath(result: ToolResult): string {
  const match = /saved (?:in full )?as (\S+\/clipboard\.(?:png|txt))/.exec(textOf(result));
  if (!match) throw new Error(`No saved path in: ${textOf(result)}`);
  return match[1];
}

function copiedImage(png: Buffer): CopiedContent {
  return { image: { png: png.toString("base64"), preview: PREVIEW } };
}

test("read_clipboard: says so when nothing usable was copied", async () => {
  assert.match(textOf(await readCopied({})), /^The clipboard holds no image, text or files/);
});

test("read_clipboard: gives a short copied link as it is", async () => {
  const result = await readCopied({ text: "https://example.com/a" });
  assert.equal(textOf(result), "The clipboard holds this text:\nhttps://example.com/a");
});

test("read_clipboard: saves long copied text in full as a file", async () => {
  const result = await readCopied({ text: LONG_TEXT });
  assert.equal(readFileSync(savedPath(result), "utf8"), LONG_TEXT);
});

test("read_clipboard: lists files copied in Finder", async () => {
  const result = await readCopied({ files: ["/a/one.pdf", "/b/two.png"] });
  assert.equal(textOf(result), "The clipboard holds files copied in Finder:\n- /a/one.pdf\n- /b/two.png");
});

test("read_clipboard: saves a copied image as a PNG attachment", async () => {
  const result = await readCopied(copiedImage(PNG_BYTES));
  assert.deepEqual(readFileSync(savedPath(result)), PNG_BYTES);
});

test("read_clipboard: shows the model the image's preview", async () => {
  const result = await readCopied(copiedImage(PNG_BYTES));
  assert.deepEqual(result.content[1], { type: "image", data: PREVIEW, mimeType: "image/jpeg" });
});

test("read_clipboard: gives an image's caption and the copied text together", async () => {
  const result = await readCopied({ ...copiedImage(PNG_BYTES), text: "caption" });
  assert.match(textOf(result), /holds an image[\s\S]*holds this text:\ncaption$/);
});

test("read_clipboard: refuses an image over the attachment limit", async () => {
  const result = await readCopied(copiedImage(Buffer.alloc(MAX_ATTACHMENT_BYTES + 1)));
  assert.match(textOf(result), /^Error: What was copied is larger than the 10\.0 MB a saved file can be\.$/);
});
