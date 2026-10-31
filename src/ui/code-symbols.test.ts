import { test } from "node:test";
import assert from "node:assert/strict";
import { codePieces, isSymbol } from "./code-symbols.js";

const symbolsIn = (line: string): string[] => codePieces(line).flatMap((p) => (p.isSymbol ? [p.text] : []));

test("code pieces: add up to the line", () => {
  const line = '  const view: ChangedFileView = make("a b", 12);';
  assert.equal(
    codePieces(line)
      .map(({ text }) => text)
      .join(""),
    line,
  );
});

test("code pieces: names are linked", () => {
  assert.deepEqual(symbolsIn("user.$name = toView(item_2);"), ["user", "$name", "toView", "item_2"]);
});

test("code pieces: language keywords aren't", () => {
  assert.deepEqual(symbolsIn("export const x = new Thing();"), ["x", "Thing"]);
});

test("code pieces: numbers aren't names", () => {
  assert.deepEqual(symbolsIn("1 + 22"), []);
});

test("code pieces: an empty line has none", () => {
  assert.deepEqual(codePieces(""), []);
});

test("symbols: a path can't pass for a name", () => {
  assert.equal(isSymbol("../secret"), false);
});

test("symbols: an option can't pass for a name", () => {
  assert.equal(isSymbol("--open-files-in-pager"), false);
});
