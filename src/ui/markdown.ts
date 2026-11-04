// A small markdown reader for workers' and the assistant's answers: headings, lists, tables, code, quotes,
// bold, italic, inline code, http(s) links and bare http(s) URLs. No imports, so the page bundles it and Node tests it.
// It yields plain data, never HTML; the page builds elements from it with text nodes only.

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "bold"; content: Inline[] }
  | { kind: "italic"; content: Inline[] }
  | { kind: "link"; text: string; href: string };

export type Block =
  | { kind: "heading"; level: number; content: Inline[] }
  | { kind: "paragraph"; lines: Inline[][] }
  | { kind: "quote"; lines: Inline[][] }
  | { kind: "list"; ordered: boolean; start: number; items: Block[][] }
  | { kind: "code"; text: string }
  | { kind: "table"; header: Inline[][]; rows: Inline[][][] };

const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;
const BULLET = /^\s*[-*+]\s+(?<body>.*)$/;
const NUMBERED = /^\s*(?<number>\d{1,9})[.)]\s+(?<body>.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_DIVIDER = /^\s*\|?(\s*:?-{3,}:?\s*\|)+(\s*:?-{3,}:?\s*)?$/;
const MARKUP = /`([^`]+)`|\*\*(.+?)\*\*|__(.+?)__|\*([^*\s](?:[^*]*[^*\s])?)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/;
/** A bare http(s) URL. It never ends on punctuation, so "(see https://x.dev/a)." links only the URL. */
const BARE_URL = /(https?:\/\/[^\s<>]*[^\s<>.,;:!?'"()[\]*_])/;
const INLINE = new RegExp(`${MARKUP.source}|${BARE_URL.source}`, "g");

/** Where a reader stopped: the block it read and the index of the first line after it. */
type Read = [Block, number];

export function parseMarkdown(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].trim()) {
      index++;
      continue;
    }
    const [block, next] = readBlock(lines, index);
    blocks.push(block);
    index = next;
  }
  return blocks;
}

function readBlock(lines: string[], start: number): Read {
  const line = lines[start];
  if (FENCE.test(line)) return readCode(lines, start);
  const heading = HEADING.exec(line);
  if (heading) return [{ kind: "heading", level: heading[1].length, content: parseInline(heading[2]) }, start + 1];
  if (isTableStart(lines, start)) return readTable(lines, start);
  if (BULLET.test(line)) return readList(lines, start, BULLET);
  if (NUMBERED.test(line)) return readList(lines, start, NUMBERED);
  if (QUOTE.test(line)) return readQuote(lines, start);
  return readParagraph(lines, start);
}

/** Index of the first line from `start` that fails `keep`. */
function endOf(lines: string[], start: number, keep: (line: string) => boolean): number {
  let index = start;
  while (index < lines.length && keep(lines[index])) index++;
  return index;
}

function readCode(lines: string[], start: number): Read {
  const end = endOf(lines, start + 1, (line) => !FENCE.test(line));
  return [{ kind: "code", text: lines.slice(start + 1, end).join("\n") }, end + 1];
}

function isTableStart(lines: string[], start: number): boolean {
  return TABLE_ROW.test(lines[start]) && TABLE_DIVIDER.test(lines[start + 1] ?? "");
}

function readTable(lines: string[], start: number): Read {
  const end = endOf(lines, start + 2, (line) => TABLE_ROW.test(line));
  const rows = lines.slice(start + 2, end).map(tableCells);
  return [{ kind: "table", header: tableCells(lines[start]), rows }, end];
}

function tableCells(row: string): Inline[][] {
  const inner = row.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split(/(?<!\\)\|/).map((cell) => parseInline(cell.trim().replace(/\\\|/g, "|")));
}

/** Blank lines between items don't end a list, so "1. a\n\n2. b" stays one list. */
function readList(lines: string[], start: number, marker: RegExp): Read {
  const items: Block[][] = [];
  let index = start;
  while (marker.test(lines[index] ?? "")) {
    const end = itemEnd(lines, index);
    items.push(parseMarkdown(itemSource(lines.slice(index, end), marker)));
    index = endOf(lines, end, (line) => !line.trim());
  }
  return [{ kind: "list", ordered: marker === NUMBERED, start: listStart(lines[start]), items }, index];
}

/** An item runs on through lines indented deeper than its marker, across blank lines, and stops at a shallower one. */
function itemEnd(lines: string[], start: number): number {
  const markerIndent = indentOf(lines[start]);
  let end = start + 1;
  for (let index = end; index < lines.length; index++) {
    if (!lines[index].trim()) continue;
    if (indentOf(lines[index]) <= markerIndent) break;
    end = index + 1;
  }
  return end;
}

/** The item as markdown of its own. Answers often indent less than the marker's width, so it dedents by what's there. */
function itemSource(itemLines: string[], marker: RegExp): string {
  const [first, ...rest] = itemLines;
  const body = marker.exec(first)?.groups?.body ?? "";
  const margin = Math.min(...rest.filter((line) => line.trim()).map(indentOf));
  return [body, ...rest.map((line) => line.slice(margin))].join("\n");
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** The source's own number: a list split by unindented bullets carries on counting instead of restarting at 1. */
function listStart(line: string): number {
  return Number(NUMBERED.exec(line)?.groups?.number ?? 1);
}

function readQuote(lines: string[], start: number): Read {
  const end = endOf(lines, start, (line) => QUOTE.test(line));
  const quoted = lines.slice(start, end).map((line) => parseInline(QUOTE.exec(line)?.[1] ?? ""));
  return [{ kind: "quote", lines: quoted }, end];
}

function readParagraph(lines: string[], start: number): Read {
  let end = start + 1;
  while (end < lines.length && lines[end].trim() && !startsBlock(lines, end)) end++;
  return [{ kind: "paragraph", lines: lines.slice(start, end).map((line) => parseInline(line.trim())) }, end];
}

function startsBlock(lines: string[], index: number): boolean {
  const starts = [FENCE, HEADING, BULLET, NUMBERED, QUOTE].some((pattern) => pattern.test(lines[index]));
  return starts || isTableStart(lines, index);
}

export function parseInline(text: string): Inline[] {
  const parts: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) parts.push({ kind: "text", text: text.slice(last, match.index) });
    parts.push(inlineFor(match));
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

function inlineFor(match: RegExpMatchArray): Inline {
  const [, code, bold, underscoreBold, italic, linkText, href, bareUrl] = match;
  if (code !== undefined) return { kind: "code", text: code };
  if (bareUrl !== undefined) return { kind: "link", text: bareUrl, href: bareUrl };
  const strong = bold ?? underscoreBold;
  if (strong !== undefined) return { kind: "bold", content: parseInline(strong) };
  if (italic !== undefined) return { kind: "italic", content: parseInline(italic) };
  return { kind: "link", text: linkText, href };
}
