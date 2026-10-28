import { test } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { editorSchema } from "./editor-config.js";

test("editor config: the editor is off without an editor section", () => {
  assert.equal(editorSchema.parse(undefined).enabled, false);
});

test("editor config: an empty editor key gets the default port", () => {
  assert.equal(editorSchema.parse(null).port, 4778);
});

test("editor config: a CLI path starting with ~ is under your home folder", () => {
  assert.equal(editorSchema.parse({ codePath: "~/bin/code-tunnel" }).codePath, `${homedir()}/bin/code-tunnel`);
});

test("editor config: a wrong type is rejected", () => {
  assert.throws(() => editorSchema.parse({ port: "4778" }));
});
