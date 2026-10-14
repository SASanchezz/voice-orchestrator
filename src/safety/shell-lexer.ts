import { readWord, ShellSyntaxError, type ShellCursor, type ShellWord } from "./shell-words.js";

export type ShellToken =
  | { kind: "word"; word: ShellWord; start: number; end: number }
  | { kind: "op"; op: string; start: number; end: number };

/** Longest first, so "&&" isn't read as two "&". */
const OPERATORS = [
  "&&", "||", ";;", "|&", "&>", ">>", ">|", ">&", "<<<", "<<-", "<<", "<&", "<>",
  ";", "|", "&", ">", "<", "(", ")", "\n",
]; // prettier-ignore
const BLANK = /[ \t\r]/;
const LINE_CONTINUATION = "\\\n";
/** A file descriptor written before a redirect, as in 2>&1. */
const FD_BEFORE_REDIRECT = /^\d+(?=[<>])/;

/** Reads a command as the shell would: words, operators, and the bodies of heredocs. */
export class ShellLexer {
  private cursor: ShellCursor;

  constructor(readonly source: string) {
    this.cursor = { source, pos: 0 };
  }

  next(): ShellToken | undefined {
    this.skipBlanksAndComments();
    const start = this.cursor.pos;
    if (start >= this.source.length) return undefined;
    const op = this.operatorHere();
    if (op === undefined) return { kind: "word", word: readWord(this.cursor), start, end: this.cursor.pos };
    return { kind: "op", op, start, end: this.cursor.pos };
  }

  /** The lines from here up to the line holding just `delimiter`, which is consumed too. */
  heredocBody(delimiter: string): string {
    const lines: string[] = [];
    while (this.cursor.pos < this.source.length) {
      const lineEnd = this.endOfLine();
      const line = this.source.slice(this.cursor.pos, lineEnd);
      this.cursor.pos = lineEnd + 1;
      if (line.replace(/^\t+/, "").trimEnd() === delimiter) return lines.join("\n");
      lines.push(line);
    }
    throw new ShellSyntaxError(`The heredoc ending in ${delimiter} never ends`);
  }

  private skipBlanksAndComments(): void {
    for (;;) {
      const char = this.source[this.cursor.pos] ?? "";
      if (this.source.startsWith(LINE_CONTINUATION, this.cursor.pos)) this.cursor.pos += LINE_CONTINUATION.length;
      else if (BLANK.test(char)) this.cursor.pos++;
      else if (char === "#") this.cursor.pos = this.endOfLine();
      else return;
    }
  }

  private endOfLine(): number {
    const end = this.source.indexOf("\n", this.cursor.pos);
    return end === -1 ? this.source.length : end;
  }

  private operatorHere(): string | undefined {
    const fd = FD_BEFORE_REDIRECT.exec(this.source.slice(this.cursor.pos))?.[0] ?? "";
    const op = OPERATORS.find((candidate) => this.source.startsWith(candidate, this.cursor.pos + fd.length));
    if (op !== undefined) this.cursor.pos += fd.length + op.length;
    return op;
  }
}
