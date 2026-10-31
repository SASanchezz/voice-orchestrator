// Finding the names in a line of code, in any language. No imports, so the server and the page both compile it.

const SYMBOL = /[\p{L}_$][\p{L}\p{N}_$]*/gu;
const WHOLE_SYMBOL = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;

/** Words of the languages themselves, which have no definition to jump to. */
const KEYWORDS = new Set(
  `abstract any as async await boolean break case catch class const continue def default delete do elif else enum
  except export extends false finally fn for from func function if impl implements import in instanceof interface let
  match module mut namespace new nil none None null number of override package pass private protected pub public
  readonly return self Self static string struct super switch this throw throws true True False trait try type typeof
  undefined use var void while with yield`.split(/\s+/),
);

/** A piece of a line; the pieces of a line add up to the line. */
export interface CodePiece {
  text: string;
  isSymbol: boolean;
}

export function isSymbol(word: string): boolean {
  return WHOLE_SYMBOL.test(word) && !KEYWORDS.has(word);
}

export function codePieces(line: string): CodePiece[] {
  const pieces: CodePiece[] = [];
  let shownUpTo = 0;
  for (const { 0: word, index } of line.matchAll(SYMBOL)) {
    if (!isSymbol(word)) continue;
    if (index > shownUpTo) pieces.push({ text: line.slice(shownUpTo, index), isSymbol: false });
    pieces.push({ text: word, isSymbol: true });
    shownUpTo = index + word.length;
  }
  if (shownUpTo < line.length) pieces.push({ text: line.slice(shownUpTo), isSymbol: false });
  return pieces;
}
