import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAttachmentContent } from "./attachment-reader.js";

function fileWith(name: string, content: string | Buffer): string {
  const path = join(mkdtempSync(join(tmpdir(), "vo-reader-")), name);
  writeFileSync(path, content);
  return path;
}

test("attachment reader: an image comes back as an image of its type", () => {
  const content = readAttachmentContent(fileWith("shot.PNG", Buffer.from([1, 2, 3])));
  assert.deepEqual(content, { kind: "image", data: "AQID", mimeType: "image/png" });
});

test("attachment reader: a text file comes back as its text", () => {
  assert.deepEqual(readAttachmentContent(fileWith("log.txt", "line one")), { kind: "text", text: "line one" });
});

test("attachment reader: a binary file is refused with a hint to use a worker", () => {
  assert.throws(() => readAttachmentContent(fileWith("app.bin", Buffer.from([0, 1, 2]))), /project worker/);
});
