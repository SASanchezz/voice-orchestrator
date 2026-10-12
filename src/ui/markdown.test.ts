import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInline, parseMarkdown } from "./markdown.js";

const text = (value: string) => ({ kind: "text", text: value });

test("markdown: bold, inline code and italic inside a line", () => {
  assert.deepEqual(parseInline("**Tests** pass in `npm test`, *mostly*"), [
    { kind: "bold", content: [text("Tests")] },
    text(" pass in "),
    { kind: "code", text: "npm test" },
    text(", "),
    { kind: "italic", content: [text("mostly")] },
  ]);
});

test("markdown: a lone asterisk or snake_case stays text", () => {
  assert.deepEqual(parseInline("2 * 3 = six_and_more"), [text("2 * 3 = six_and_more")]);
});

test("markdown: only http(s) links become links", () => {
  assert.deepEqual(parseInline("[docs](https://x.dev) [bad](javascript:alert(1))"), [
    { kind: "link", text: "docs", href: "https://x.dev" },
    text(" [bad](javascript:alert(1))"),
  ]);
});

test("markdown: HTML stays text", () => {
  assert.deepEqual(parseMarkdown("<img src=x onerror=alert(1)>"), [
    { kind: "paragraph", lines: [[text("<img src=x onerror=alert(1)>")]] },
  ]);
});

test("markdown: a pipe table becomes header and rows", () => {
  assert.deepEqual(parseMarkdown("| Check | Result |\n|---|:---:|\n| lint | **ok** |"), [
    {
      kind: "table",
      header: [[text("Check")], [text("Result")]],
      rows: [[[text("lint")], [{ kind: "bold", content: [text("ok")] }]]],
    },
  ]);
});

test("markdown: dashes make a list and numbers an ordered one", () => {
  assert.deepEqual(parseMarkdown("- one\n- two\n\n1. first"), [
    { kind: "list", ordered: false, items: [[text("one")], [text("two")]] },
    { kind: "list", ordered: true, items: [[text("first")]] },
  ]);
});

test("markdown: headings, and paragraph lines kept apart", () => {
  assert.deepEqual(parseMarkdown("## Summary\nDone.\nAll green."), [
    { kind: "heading", level: 2, content: [text("Summary")] },
    { kind: "paragraph", lines: [[text("Done.")], [text("All green.")]] },
  ]);
});

test("markdown: a fenced block is kept verbatim", () => {
  assert.deepEqual(parseMarkdown("```ts\nconst a = **b**;\n```\nafter"), [
    { kind: "code", text: "const a = **b**;" },
    { kind: "paragraph", lines: [[text("after")]] },
  ]);
});

test("markdown: a paragraph ends where a list starts", () => {
  assert.deepEqual(
    parseMarkdown("Changes:\n- a").map((block) => block.kind),
    ["paragraph", "list"],
  );
});
