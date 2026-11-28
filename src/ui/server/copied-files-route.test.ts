import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { z } from "zod";
import { TestClipboard } from "../../testing/test-clipboard.js";
import { CopiedFilesRoute } from "./copied-files-route.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";

const TOKEN = "secret";
const COPIED_FILES_URL = new URL(`http://127.0.0.1/api/clipboard/files?token=${TOKEN}`);
const copiedPathsSchema = z.array(z.object({ path: z.string(), isFolder: z.boolean() }));

const access = {
  requireToken(candidate: string | string[] | null | undefined, refusal: string): void {
    if (candidate !== TOKEN) throw new HttpError(HTTP_STATUS.unauthorized, refusal);
  },
};

/** A response that keeps what the route sent instead of sending it anywhere. */
class KeptResponse extends ServerResponse {
  body = "";

  constructor() {
    super(new IncomingMessage(new Socket()));
  }

  override end(chunk?: unknown): this {
    if (typeof chunk === "string") this.body = chunk;
    return this;
  }
}

async function copiedPathsFor(files: string[]): Promise<z.infer<typeof copiedPathsSchema>> {
  const clipboard = new TestClipboard();
  clipboard.copied = { files };
  const res = new KeptResponse();
  await new CopiedFilesRoute(access, clipboard).route(COPIED_FILES_URL, res);
  return copiedPathsSchema.parse(JSON.parse(res.body));
}

function copiedFolderAndFile(): { folder: string; file: string } {
  const root = mkdtempSync(join(tmpdir(), "copied-files-"));
  const folder = join(root, "src");
  mkdirSync(folder);
  const file = join(root, "notes.txt");
  writeFileSync(file, "notes");
  return { folder, file };
}

test("copied files route: a copied folder is told as a folder", async () => {
  const { folder } = copiedFolderAndFile();
  assert.deepEqual(await copiedPathsFor([folder]), [{ path: folder, isFolder: true }]);
});

test("copied files route: a copied file is told as a file", async () => {
  const { file } = copiedFolderAndFile();
  assert.deepEqual(await copiedPathsFor([file]), [{ path: file, isFolder: false }]);
});

test("copied files route: a copied file deleted since is still told, as a file", async () => {
  const gone = join(tmpdir(), "copied-files-never-there", "gone.txt");
  assert.deepEqual(await copiedPathsFor([gone]), [{ path: gone, isFolder: false }]);
});

test("copied files route: nothing copied gives no paths", async () => {
  assert.deepEqual(await copiedPathsFor([]), []);
});

test("copied files route: a request without the token is refused", async () => {
  const route = new CopiedFilesRoute(access, new TestClipboard());
  const noToken = new URL("http://127.0.0.1/api/clipboard/files");
  await assert.rejects(route.route(noToken, new KeptResponse()), HttpError);
});
