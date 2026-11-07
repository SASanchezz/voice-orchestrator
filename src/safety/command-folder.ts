// Where a shell command's git calls run, so a rule can depend on the branch checked out there. Anything that could
// make the answer wrong (a later cd, a subshell, a variable in a path, a branch switch) makes it unknown instead.

import { resolve } from "node:path";
import { commandWords } from "./read-only-commands.js";
import { isReadOnlyGit, GLOBAL_OPTIONS_WITH_VALUE } from "./read-only-git.js";
import { parseShell, type ShellSegment } from "./shell-parse.js";

/** Thrown when the folder a command's git calls run in can't be told for sure. */
export class FolderUnknownError extends Error {}

const FOLDER_CHANGERS = new Set(["cd", "pushd", "popd"]);
/** Subcommands that change which branch is checked out, or what it is called. */
const BRANCH_CHANGERS = new Set(["checkout", "switch", "symbolic-ref", "update-ref"]);
/** Options that point git at another repository or work tree than the folder it runs in. */
const REPOSITORY_OVERRIDES = new Set(["--git-dir", "--work-tree"]);
/** Shell expansions that only the shell can resolve. */
const EXPANDS = /[$~*?`]/;
const ONLY_AND_AFTER = /^\s*(&&|$)/;
const MENTIONS_GIT = /\b(git|cd|pushd|popd)\b/;

/** The one folder every git call in `command` runs in, starting from `startFolder`. Throws FolderUnknownError. */
export function commandFolder(command: string, startFolder: string): string {
  const segments = parseShell(command);
  const startsWithCd = segments.length > 0 && programOf(segments[0]) === "cd";
  const folder = startsWithCd ? leadingCdFolder(command, segments[0], startFolder) : startFolder;
  const rest = startsWithCd ? segments.slice(1) : segments;
  rest.forEach(requireNoHiddenGit);
  const folders = new Set(rest.filter(isGit).map((segment) => gitFolder(segment, folder)));
  if (folders.size > 1) throw new FolderUnknownError("git runs in more than one folder");
  return [...folders][0] ?? folder;
}

/** A leading `cd <dir> &&` moves every later part; a `cd` anywhere else could move only some of them. */
function leadingCdFolder(command: string, cd: ShellSegment, startFolder: string): string {
  const written = command.trimStart();
  const followedByAnd = written.startsWith(cd.raw) && ONLY_AND_AFTER.test(written.slice(cd.raw.length));
  if (!followedByAnd) throw new FolderUnknownError("cd isn't at the start, followed by &&");
  const args = commandWords(cd.words).slice(1);
  if (args.length !== 1) throw new FolderUnknownError("cd without exactly one folder");
  return resolve(startFolder, plainPath(args[0]));
}

function requireNoHiddenGit(segment: ShellSegment): void {
  if (FOLDER_CHANGERS.has(programOf(segment))) throw new FolderUnknownError("the folder changes mid-command");
  if (segment.substitutions.some((text) => MENTIONS_GIT.test(text)))
    throw new FolderUnknownError("git or cd inside $(…)");
  if (segment.words.some((word) => word.text.startsWith("GIT_")))
    throw new FolderUnknownError("a GIT_ variable is set");
  if (!isGit(segment) && segment.words.some((word) => MENTIONS_GIT.test(word.text)))
    throw new FolderUnknownError("git run through another program");
}

/** -C options move git, each relative to the last; a branch switch or another repository makes the branch unknown. */
function gitFolder(segment: ShellSegment, folder: string): string {
  const args = commandWords(segment.words).slice(1);
  let at = folder;
  let i = 0;
  while (i < args.length && args[i].startsWith("-")) {
    if (REPOSITORY_OVERRIDES.has(args[i].split("=")[0])) throw new FolderUnknownError(`git ${args[i]}`);
    if (args[i] === "-C") at = resolve(at, plainPath(args[i + 1] ?? ""));
    i += GLOBAL_OPTIONS_WITH_VALUE.has(args[i]) ? 2 : 1;
  }
  requireSameBranch(args.slice(i));
  return at;
}

function requireSameBranch([subcommand, ...rest]: string[]): void {
  const renamesBranch = subcommand === "branch" && !isReadOnlyGit(["branch", ...rest]);
  if (BRANCH_CHANGERS.has(subcommand) || renamesBranch) throw new FolderUnknownError(`git ${subcommand}`);
}

function plainPath(text: string): string {
  if (!text || EXPANDS.test(text)) throw new FolderUnknownError(`a folder the shell would expand: ${text}`);
  return text;
}

function isGit(segment: ShellSegment): boolean {
  return programOf(segment) === "git";
}

function programOf(segment: ShellSegment): string {
  return commandWords(segment.words)[0] ?? "";
}
