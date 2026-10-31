import { join } from "node:path";
import { z } from "zod";
import { namesSecretFile } from "../safety/secret-files.js";
import type { DefinitionKind, DefinitionView, SnippetLine } from "../ui/change-views.js";
import { definitionMatcher } from "./definition-lines.js";
import { readLines } from "./file-lines.js";
import { repositoryRootOf, runGit, type GitRunner } from "./git-runner.js";

/** Tracked and new files, not ignored ones such as node_modules; `-z` keeps any file name whole. */
const SEARCH = ["grep", "-n", "-z", "-I", "-w", "-F", "--untracked", "-e"];
const MAX_DEFINITIONS = 12;
/** Longer lines are generated code; they'd also slow the patterns down. */
const MAX_LINE_LENGTH = 500;
const SNIPPET_LINES_BEFORE = 4;
const SNIPPET_LINES_AFTER = 30;
const KIND_ORDER: DefinitionKind[] = ["definition", "implementation", "member"];

const searchResult = z.string().regex(/^[^\0]+\0\d+\0.*$/s);

interface Candidate {
  path: string;
  line: number;
  kind: DefinitionKind;
}

/** Finds where a name is defined by searching the project's own files, so it works in any language. */
export class GitDefinitions {
  constructor(private git: GitRunner = runGit) {}

  /** The best places first, those in `fromFile` first among equals. */
  async of(folder: string, symbol: string, fromFile: string): Promise<DefinitionView[]> {
    const root = await repositoryRootOf(this.git, folder);
    if (!root) return [];
    const best = candidatesIn(await this.search(root, symbol), symbol).toSorted(byRank(fromFile));
    const views = best.slice(0, MAX_DEFINITIONS).map((candidate) => withSnippet(root, candidate));
    return (await Promise.all(views)).flat();
  }

  /** Git exits with an error when nothing matches. */
  private async search(root: string, symbol: string): Promise<string> {
    try {
      return await this.git(root, [...SEARCH, symbol]);
    } catch {
      return "";
    }
  }
}

function candidatesIn(output: string, symbol: string): Candidate[] {
  const kindOf = definitionMatcher(symbol);
  return output
    .split("\n")
    .filter((record) => record !== "")
    .flatMap((record) => candidateFrom(record, kindOf));
}

function candidateFrom(record: string, kindOf: ReturnType<typeof definitionMatcher>): Candidate[] {
  const [path, line, ...text] = searchResult.parse(record).split("\0");
  const code = text.join("\0");
  const kind = code.length > MAX_LINE_LENGTH ? undefined : kindOf(code);
  return kind && !namesSecretFile(path) ? [{ path, line: Number(line), kind }] : [];
}

function byRank(fromFile: string): (a: Candidate, b: Candidate) => number {
  const isElsewhere = ({ path }: Candidate): number => Number(path !== fromFile);
  return (a, b) => rank(a) - rank(b) || isElsewhere(a) - isElsewhere(b) || a.path.localeCompare(b.path);
}

function rank({ kind }: Candidate): number {
  return KIND_ORDER.indexOf(kind);
}

/** A file too large or odd to read just drops out of the list. */
async function withSnippet(root: string, candidate: Candidate): Promise<DefinitionView[]> {
  try {
    const lines = await readLines(join(root, candidate.path));
    return [{ ...candidate, snippet: snippetAround(lines, candidate.line) }];
  } catch {
    return [];
  }
}

function snippetAround(lines: string[], line: number): SnippetLine[] {
  const first = Math.max(1, line - SNIPPET_LINES_BEFORE);
  const shown = lines.slice(first - 1, line + SNIPPET_LINES_AFTER);
  return shown.map((text, index) => ({ line: first + index, text }));
}
