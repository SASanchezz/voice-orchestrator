// A small markdown reader for workers' and the assistant's answers: headings, lists, tables, code, quotes,
// bold, italic, inline code and http(s) links. No imports, so the page bundles it and Node tests it.
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
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "code"; text: string }
  | { kind: "table"; header: Inline[][]; rows: Inline[][][] };

const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d{1,9}[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_DIVIDER = /^\s*\|?(\s*:?-{3,}:?\s*\|)+(\s*:?-{3,}:?\s*)?$/;
const INLINE = /`([^`]+)`|\*\*(.+?)\*\*|__(.+?)__|\*([^*\s](?:[^*]*[^*\s])?)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

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

function readList(lines: string[], start: number, marker: RegExp): Read {
  const end = endOf(lines, start, (line) => marker.test(line));
  const items = lines.slice(start, end).map((line) => parseInline(marker.exec(line)?.[1] ?? ""));
  return [{ kind: "list", ordered: marker === NUMBERED, items }, end];
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
  const [, code, bold, underscoreBold, italic, linkText, href] = match;
  if (code !== undefined) return { kind: "code", text: code };
  const strong = bold ?? underscoreBold;
  if (strong !== undefined) return { kind: "bold", content: parseInline(strong) };
  if (italic !== undefined) return { kind: "italic", content: parseInline(italic) };
  return { kind: "link", text: linkText, href };
}
