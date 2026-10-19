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

test("markdown: two fenced commands stay two blocks, each copied on its own", () => {
  assert.deepEqual(parseMarkdown("Run:\n```\nnpm ci\n```\n```bash\nnpm test -- --watch\n```"), [
    { kind: "paragraph", lines: [[text("Run:")]] },
    { kind: "code", text: "npm ci" },
    { kind: "code", text: "npm test -- --watch" },
  ]);
});

const link = (url: string) => ({ kind: "link", text: url, href: url });

test("markdown: a bare https URL becomes a link", () => {
  assert.deepEqual(parseInline("See https://casini.atlassian.net/browse/TASK-7 for it"), [
    text("See "),
    link("https://casini.atlassian.net/browse/TASK-7"),
    text(" for it"),
  ]);
});

test("markdown: a bare http URL becomes a link", () => {
  assert.deepEqual(parseInline("http://localhost:7302/"), [link("http://localhost:7302/")]);
});

test("markdown: punctuation after a bare URL stays text", () => {
  assert.deepEqual(parseInline("(see https://x.dev/a?b=1)."), [text("(see "), link("https://x.dev/a?b=1"), text(").")]);
});

test("markdown: a markdown link is linked once, by its own text", () => {
  assert.deepEqual(parseInline("[TASK-7](https://x.atlassian.net/browse/TASK-7)"), [
    { kind: "link", text: "TASK-7", href: "https://x.atlassian.net/browse/TASK-7" },
  ]);
});

test("markdown: a markdown link whose text is its URL is linked once", () => {
  assert.deepEqual(parseInline("[https://x.dev](https://x.dev)"), [
    { kind: "link", text: "https://x.dev", href: "https://x.dev" },
  ]);
});

test("markdown: a URL in inline code stays code", () => {
  assert.deepEqual(parseInline("`curl https://x.dev`"), [{ kind: "code", text: "curl https://x.dev" }]);
});

test("markdown: a URL in a fenced block stays code", () => {
  assert.deepEqual(parseMarkdown("```\nopen https://x.dev\n```"), [{ kind: "code", text: "open https://x.dev" }]);
});

test("markdown: a bare URL in a table cell becomes a link", () => {
  const [table] = parseMarkdown("| Task | Link |\n| --- | --- |\n| TASK-7 | https://x.atlassian.net/browse/TASK-7 |");
  assert.deepEqual(table?.kind === "table" && table.rows[0]?.[1], [link("https://x.atlassian.net/browse/TASK-7")]);
});

test("markdown: a bare URL inside bold is linked", () => {
  assert.deepEqual(parseInline("**https://x.dev/a**"), [{ kind: "bold", content: [link("https://x.dev/a")] }]);
});

test("markdown: other schemes are never linked", () => {
  assert.deepEqual(parseInline("javascript:alert(1) ftp://x.dev file:///etc/passwd"), [
    text("javascript:alert(1) ftp://x.dev file:///etc/passwd"),
  ]);
});
