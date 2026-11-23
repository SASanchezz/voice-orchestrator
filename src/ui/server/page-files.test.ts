import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { APP_DIR } from "../../config/paths.js";
import { STATIC_FILES } from "./page-files.js";

const PAGES = ["src/ui/public/index.html", "src/ui/public/notice.html", "src/ui/public/quick.html"];

function linkedStylesheets(page: string): string[] {
  const html = readFileSync(resolve(APP_DIR, page), "utf8");
  return [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((match) => match[1]);
}

test("page files: every stylesheet a page links is served", () => {
  const unserved = PAGES.flatMap(linkedStylesheets).filter((path) => !(path in STATIC_FILES));
  assert.deepEqual(unserved, []);
});
