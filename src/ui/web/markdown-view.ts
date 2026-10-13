// Markdown answers as formatted elements. Built from the parsed blocks with text nodes only, so no text becomes markup.

import { parseMarkdown, type Block, type Inline } from "../markdown.js";
import { copyButton, el } from "./dom.js";

/** Chat headings stay small: # is a section title, not a page title. */
const HEADING_TAGS = ["h3", "h4", "h5", "h6", "h6", "h6"] as const;

export function markdownView(text: string, className = ""): HTMLDivElement {
  return el("div", { class: `markdown ${className}`.trim() }, ...parseMarkdown(text).map(blockNode));
}

function blockNode(block: Block): HTMLElement {
  if (block.kind === "heading") return el(HEADING_TAGS[block.level - 1], {}, ...inlineNodes(block.content));
  if (block.kind === "paragraph") return el("p", {}, ...withLineBreaks(block.lines));
  if (block.kind === "quote") return el("blockquote", {}, ...withLineBreaks(block.lines));
  if (block.kind === "code") return codeBlock(block.text);
  if (block.kind === "table") return tableNode(block.header, block.rows);
  return el(block.ordered ? "ol" : "ul", {}, ...block.items.map((item) => el("li", {}, ...inlineNodes(item))));
}

/** A command or snippet, with a button that copies exactly it. */
function codeBlock(code: string): HTMLDivElement {
  return el("div", { class: "code-block" }, el("pre", {}, el("code", {}, code)), copyButton(code, "Copy to clipboard"));
}

function tableNode(header: Inline[][], rows: Inline[][][]): HTMLDivElement {
  const head = el("thead", {}, tableRow(header, "th"));
  const body = el("tbody", {}, ...rows.map((cells) => tableRow(cells, "td")));
  return el("div", { class: "table-wrap" }, el("table", {}, head, body));
}

function tableRow(cells: Inline[][], tag: "th" | "td"): HTMLTableRowElement {
  return el("tr", {}, ...cells.map((cell) => el(tag, {}, ...inlineNodes(cell))));
}

function withLineBreaks(lines: Inline[][]): (Node | string)[] {
  return lines.flatMap((line, index) => [...(index ? [el("br")] : []), ...inlineNodes(line)]);
}

function inlineNodes(parts: Inline[]): (Node | string)[] {
  return parts.map((part) => {
    if (part.kind === "text") return part.text;
    if (part.kind === "code") return el("code", {}, part.text);
    if (part.kind === "bold") return el("strong", {}, ...inlineNodes(part.content));
    if (part.kind === "italic") return el("em", {}, ...inlineNodes(part.content));
    return el("a", { href: part.href, target: "_blank", rel: "noopener noreferrer" }, part.text);
  });
}
