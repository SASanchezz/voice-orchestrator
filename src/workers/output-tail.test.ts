import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lastOutputLine } from "./output-tail.js";

const ESCAPE = "\u001b";

const fileWith = (text: string): string => {
  const path = join(mkdtempSync(join(tmpdir(), "tail-")), "task.output");
  writeFileSync(path, text);
  return path;
};

test("the last line skips trailing blank lines", () => {
  assert.equal(lastOutputLine(fileWith("first\nsecond\n\n")), "second");
});

test("a progress bar's latest redraw is the last line", () => {
  assert.equal(lastOutputLine(fileWith("10%\r50%\r80%")), "80%");
});

test("terminal colors are left out", () => {
  assert.equal(lastOutputLine(fileWith(`${ESCAPE}[32mdone${ESCAPE}[0m\n`)), "done");
});

test("a file not written yet has no last line", () => {
  assert.equal(lastOutputLine(join(tmpdir(), "no-such-task.output")), "");
});

test("a long line is cut short", () => {
  assert.equal(lastOutputLine(fileWith("x".repeat(500))).length, 120);
});
