import { test } from "node:test";
import assert from "node:assert/strict";
import { definitionMatcher } from "./definition-lines.js";

const DEFINITIONS: [string, string][] = [
  ["Thing", "export class Thing {"],
  ["Thing", "export interface Thing<T> {"],
  ["Thing", "type Thing = string;"],
  ["make", "export async function make(a: string): Promise<void> {"],
  ["make", "const make = (a) => a;"],
  ["make", "  async make(a: string): Promise<void> {"],
  ["make", "  private async make("],
  ["make", "  make(): void {}"],
  ["make", "  make(a: string): void;"],
  ["make", "  make = async (a) => a;"],
  ["make", "def make(self):"],
  ["make", "func (s *Shop) make() error {"],
  ["make", "pub fn make() -> u8 {"],
  ["make", "  public void make(String a) {"],
  ["Limit", "Limit = 3"],
  ["$make", "function $make() {"],
];

for (const [symbol, line] of DEFINITIONS) {
  test(`definition lines: ${line.trim()} defines ${symbol}`, () => {
    assert.equal(definitionMatcher(symbol)(line), "definition");
  });
}

const MENTIONS: [string, string][] = [
  ["make", "  make(a);"],
  ["make", "  return make(a);"],
  ["make", "  await make(a).then(() => {"],
  ["make", "// function make() is gone"],
  ["make", " * class make"],
  ["Thing", 'import { Thing } from "./thing.js";'],
  ["Thing", 'import type Thing from "./thing.js";'],
  ["Thing", "const a: Thing = b;"],
  ["make", "function makeAll() {"],
  ["make", "  if (a == make) {"],
];

for (const [symbol, line] of MENTIONS) {
  test(`definition lines: ${line.trim()} only mentions ${symbol}`, () => {
    assert.equal(definitionMatcher(symbol)(line), undefined);
  });
}

test("definition lines: a class implementing an interface is its implementation", () => {
  assert.equal(definitionMatcher("Editor")("export class OffEditor implements Editor {"), "implementation");
});

test("definition lines: one of several interfaces counts", () => {
  assert.equal(definitionMatcher("Editor")("class A extends B implements C, Editor {"), "implementation");
});

test("definition lines: a Python base class counts", () => {
  assert.equal(definitionMatcher("Base")("class Child(Base):"), "implementation");
});

test("definition lines: an interface's field is a member", () => {
  assert.equal(definitionMatcher("path")("  path: string;"), "member");
});

test("definition lines: a class's field is a member", () => {
  assert.equal(definitionMatcher("count")("  private count = 0;"), "member");
});
