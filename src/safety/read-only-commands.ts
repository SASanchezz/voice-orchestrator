// Commands that only search, list or read, so a worker may run them without asking. A command line counts only if
// every part of it does: each command between &&, ;, | and line breaks, and each $(…) inside them.

import { isReadOnlyNode, isReadOnlyPython } from "./read-only-code.js";
import { isReadOnlyGit } from "./read-only-git.js";
import { isReadOnlyCurl, isReadOnlyWget } from "./read-only-web.js";
import { parseShell, type ShellSegment } from "./shell-parse.js";
import { ShellSyntaxError, type ShellWord } from "./shell-words.js";

type ReadOnlyCheck = (args: string[], stdin: string[]) => boolean;

/** Programs that read or print and never change anything, whatever their arguments. */
const ALWAYS_READ_ONLY = [
  "ls", "cat", "head", "tail", "grep", "egrep", "fgrep", "wc", "echo", "printf", "pwd", "cd", "which", "type", "file",
  "stat", "du", "df", "cut", "tr", "diff", "cmp", "comm", "basename", "dirname", "realpath", "readlink", "whoami",
  "uname", "jq", "column", "nl", "true", "false", "test", "[", "od", "strings", "md5", "md5sum", "shasum", "sha1sum",
  "sha256sum", "cksum",
]; // prettier-ignore
/** find actions that delete, run programs or write files. */
const FIND_CHANGES = new Set(["-delete", "-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprint0", "-fprintf", "-fls"]); // prettier-ignore
/** sed commands in a script that write a file (w, W) or run one (e). */
const SED_WRITES_OR_RUNS = /(^|[;}\s\d/$])[wWe](\s|$)/;
const XARGS_OPTIONS_WITH_VALUE = new Set(["-I", "-n", "-L", "-P", "-d", "-s", "-E", "-a"]);
const ASSIGNMENT = /^\w+=/;

const always: ReadOnlyCheck = () => true;
const PROGRAMS = new Map<string, ReadOnlyCheck>([
  ...ALWAYS_READ_ONLY.map((name): [string, ReadOnlyCheck] => [name, always]),
  ["sort", (args) => !args.some((arg) => arg.startsWith("--output") || /^-[^-]*o/.test(arg))],
  ["uniq", (args) => args.filter((arg) => !arg.startsWith("-")).length <= 1],
  ["tree", (args) => !args.includes("-o")],
  ["rg", (args) => !args.some((arg) => arg.startsWith("--pre"))],
  ["find", (args) => !args.some((arg) => FIND_CHANGES.has(arg))],
  ["sed", isReadOnlySed],
  ["git", isReadOnlyGit],
  ["curl", isReadOnlyCurl],
  ["wget", isReadOnlyWget],
  ["python", isReadOnlyPython],
  ["python3", isReadOnlyPython],
  ["node", isReadOnlyNode],
  ["xargs", (args) => isReadOnlyArgv(xargsCommand(args), [])],
]);

/** Only reads, lists or searches, in every part; a command that isn't complete shell is never read-only. */
export function isReadOnlyCommand(command: string): boolean {
  try {
    return parseShell(command).every(isReadOnlySegment);
  } catch (e) {
    if (e instanceof ShellSyntaxError) return false;
    throw e;
  }
}

/** Writes no file through a redirect, and its program and every $(…) in it only read. */
export function isReadOnlySegment(segment: ShellSegment): boolean {
  if (segment.writes.length || !segment.substitutions.every(isReadOnlyCommand)) return false;
  return isReadOnlyArgv(commandWords(segment.words), segment.stdin);
}

/** The program and its arguments, after any VAR=value set for it. */
export function commandWords(words: ShellWord[]): string[] {
  const first = words.findIndex((word) => word.quoted || !ASSIGNMENT.test(word.text));
  return first === -1 ? [] : words.slice(first).map((word) => word.text);
}

/** Only setting variables is harmless; a program run by a path (./ls) is never trusted. */
function isReadOnlyArgv(argv: string[], stdin: string[]): boolean {
  if (!argv.length) return true;
  const [program, ...args] = argv;
  return PROGRAMS.get(program)?.(args, stdin) ?? false;
}

/** Without -i, sed only prints. */
function isReadOnlySed(args: string[]): boolean {
  const editsInPlace = args.some((arg) => arg.startsWith("--in-place") || /^-[^-]*i/.test(arg));
  return !editsInPlace && !args.some((arg) => SED_WRITES_OR_RUNS.test(arg));
}

/** The command xargs runs; echo when none is given. */
function xargsCommand(args: string[]): string[] {
  let i = 0;
  while (i < args.length && args[i].startsWith("-")) i += XARGS_OPTIONS_WITH_VALUE.has(args[i]) ? 2 : 1;
  return args.slice(i);
}
