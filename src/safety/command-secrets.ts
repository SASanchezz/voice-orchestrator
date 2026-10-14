// Shell commands that would read a secret: a secret file in any part of them, the macOS keychain, or the environment.

import { isReadOnlySegment, commandWords } from "./read-only-commands.js";
import { namesSecretFile } from "./secret-files.js";
import { parseShell, type ShellSegment } from "./shell-parse.js";
import { ShellSyntaxError } from "./shell-words.js";

/** These only show that a file is there, not what is in it. */
const LISTING_PROGRAMS = new Set(["ls", "stat", "du", "tree", "find", "test", "[", "basename", "dirname", "realpath", "readlink", "echo", "printf"]); // prettier-ignore
const GIT_LISTING = new Set(["check-ignore", "check-attr", "ls-files", "status"]);
const KEYCHAIN_READS = new Set(["find-generic-password", "find-internet-password", "dump-keychain", "export"]);

/** A command that isn't complete shell is checked as written. */
export function commandReadsSecrets(command: string): boolean {
  try {
    return parseShell(command).some(segmentReadsSecrets);
  } catch (e) {
    if (e instanceof ShellSyntaxError) return namesSecretFile(command);
    throw e;
  }
}

function segmentReadsSecrets(segment: ShellSegment): boolean {
  const argv = commandWords(segment.words);
  if (printsSecrets(argv) || segment.substitutions.some(commandReadsSecrets)) return true;
  const fed = [...segment.reads, ...segment.stdin];
  const named = onlyLists(argv, segment) ? [] : argv.slice(1);
  return [...fed, ...named].some(namesSecretFile);
}

/** The keychain's passwords, or every environment variable with the tokens in them. */
function printsSecrets([program, ...args]: string[]): boolean {
  if (program === "security") return KEYCHAIN_READS.has(args[0]);
  if (program === "printenv") return true;
  return program === "env" && args.every((arg) => arg.startsWith("-") || arg.includes("="));
}

function onlyLists([program, ...args]: string[], segment: ShellSegment): boolean {
  if (program === "git") return GIT_LISTING.has(args.find((arg) => !arg.startsWith("-")) ?? "");
  return LISTING_PROGRAMS.has(program) && isReadOnlySegment(segment);
}
