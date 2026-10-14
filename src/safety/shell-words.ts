// Reads one word of a shell command: quotes and escapes taken out, $(…) and `…` kept and listed.

/** A word of a shell command, with its quotes and escapes taken out. */
export interface ShellWord {
  text: string;
  /** Some of it was quoted: text the program is given, not a name or option. */
  quoted: boolean;
  /** The commands inside its $(…) and `…`, each run before the word is used. */
  substitutions: string[];
}

/** The command isn't complete shell: an unclosed quote, $( or heredoc, often from a cut-off command. */
export class ShellSyntaxError extends Error {}

/** A command's text and how far it has been read. */
export interface ShellCursor {
  readonly source: string;
  pos: number;
}

const WORD_END = /[\s;&|<>()]/;
/** Only these keep their meaning after a backslash inside double quotes. */
const DOUBLE_QUOTE_ESCAPES = '"\\$`\n';
const ESCAPE_LENGTH = "\\x".length;

export function readWord(cursor: ShellCursor): ShellWord {
  const word: ShellWord = { text: "", quoted: false, substitutions: [] };
  while (cursor.pos < cursor.source.length && !WORD_END.test(cursor.source[cursor.pos])) readWordPart(cursor, word);
  return word;
}

function readWordPart(cursor: ShellCursor, word: ShellWord): void {
  const char = cursor.source[cursor.pos];
  if (char === "'") return readSingleQuoted(cursor, word);
  if (char === '"') return readDoubleQuoted(cursor, word);
  if (atSubstitution(cursor)) return readSubstitution(cursor, word);
  if (char === "\\") {
    word.text += cursor.source[cursor.pos + 1] ?? "";
    cursor.pos += ESCAPE_LENGTH;
    return;
  }
  word.text += char;
  cursor.pos++;
}

function readSingleQuoted(cursor: ShellCursor, word: ShellWord): void {
  const close = cursor.source.indexOf("'", cursor.pos + 1);
  if (close === -1) throw new ShellSyntaxError("A single quote is never closed");
  word.text += cursor.source.slice(cursor.pos + 1, close);
  word.quoted = true;
  cursor.pos = close + 1;
}

function readDoubleQuoted(cursor: ShellCursor, word: ShellWord): void {
  word.quoted = true;
  cursor.pos++;
  while (cursor.source[cursor.pos] !== '"') {
    if (cursor.pos >= cursor.source.length) throw new ShellSyntaxError("A double quote is never closed");
    readDoubleQuotedPart(cursor, word);
  }
  cursor.pos++;
}

function readDoubleQuotedPart(cursor: ShellCursor, word: ShellWord): void {
  if (atSubstitution(cursor)) return readSubstitution(cursor, word);
  const char = cursor.source[cursor.pos];
  const next = cursor.source[cursor.pos + 1] ?? "";
  const escaped = char === "\\" && DOUBLE_QUOTE_ESCAPES.includes(next);
  word.text += escaped ? next : char;
  cursor.pos += escaped ? ESCAPE_LENGTH : 1;
}

function atSubstitution(cursor: ShellCursor): boolean {
  return cursor.source.startsWith("$(", cursor.pos) || cursor.source[cursor.pos] === "`";
}

/** Kept in the word as written, and listed as a command of its own. */
function readSubstitution(cursor: ShellCursor, word: ShellWord): void {
  const backtick = cursor.source[cursor.pos] === "`";
  const close = backtick ? cursor.source.indexOf("`", cursor.pos + 1) : closingParen(cursor, cursor.pos + 1);
  if (close === -1) throw new ShellSyntaxError("A backtick is never closed");
  const openLength = backtick ? "`".length : "$(".length;
  word.substitutions.push(cursor.source.slice(cursor.pos + openLength, close));
  word.text += cursor.source.slice(cursor.pos, close + 1);
  cursor.pos = close + 1;
}

/** Where the $( whose "(" is at `open` closes, skipping single-quoted text. */
function closingParen({ source }: ShellCursor, open: number): number {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "'") i = source.indexOf("'", i + 1);
    if (i === -1) break;
    if (source[i] === "(") depth++;
    if (source[i] === ")") depth--;
    if (depth === 0) return i;
  }
  throw new ShellSyntaxError("A $( is never closed");
}
