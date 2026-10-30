// One file's unified diff as lines to show, with the line number each has in the new file. No imports, so the page
// bundles it and Node tests it.

export type DiffLineKind = "hunk" | "added" | "removed" | "context";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  /** Where it sits in the new file; removed lines and hunk headers have no place there. */
  newLine?: number;
}

const HUNK_HEAD = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** Everything before the first hunk is git's file header, which the page has no use for. */
export function diffLines(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let nextNewLine: number | undefined;
  for (const raw of patch.split("\n")) {
    const hunk = HUNK_HEAD.exec(raw);
    if (hunk) nextNewLine = Number(hunk[1]);
    if (nextNewLine === undefined) continue;
    const line = hunk ? { kind: "hunk" as const, text: raw } : bodyLine(raw, nextNewLine);
    if (!line) continue;
    lines.push(line);
    if (line.newLine !== undefined) nextNewLine += 1;
  }
  return lines;
}

/** Neither the end of the patch nor git's "\ No newline at end of file" is a line of the file. */
function bodyLine(raw: string, newLine: number): DiffLine | undefined {
  const text = raw.slice(1);
  if (raw.startsWith("+")) return { kind: "added", text, newLine };
  if (raw.startsWith("-")) return { kind: "removed", text };
  if (raw.startsWith(" ")) return { kind: "context", text, newLine };
  return undefined;
}
