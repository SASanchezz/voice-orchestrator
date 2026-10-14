// What the destructive rules read in a shell command: the programs and options of each part that could change
// something. Read-only parts are left out, and so is data — paths, file names and quoted text — unless the part runs
// text as code (a shell, ssh, a SQL client, a language runtime), where every word may be a command.

import { isReadOnlySegment } from "./read-only-commands.js";
import { parseShell, type ShellSegment } from "./shell-parse.js";
import { ShellSyntaxError, type ShellWord } from "./shell-words.js";
import { normalizeCommand } from "./tool-calls.js";

/** Programs that run the text they are given, so a quoted `DROP TABLE` or `rm -rf` in it is a real command. */
const CODE_RUNNERS = new Set([
  "sh", "bash", "zsh", "dash", "fish", "eval", "exec", "source", ".", "ssh", "sudo", "doas", "env", "xargs", "watch",
  "timeout", "nohup", "nice", "time", "command", "psql", "mysql", "sqlite3", "mongo", "mongosh", "redis-cli",
  "python", "python3", "node", "ruby", "perl", "php", "deno", "bun",
]); // prettier-ignore
/** Stands in for data, so a rule such as \brm\s+-rf\s+ still sees that something follows. */
const DATA = "_";
const PATH_LIKE = /\/|^\.[^./]|^[^-=][^=]*\.[A-Za-z0-9]{1,8}$/;

/** The texts to test rules against; a command that isn't complete shell is tested whole, as written. */
export function destructiveCandidates(command: string): string[] {
  return withNormalForm(partsThatMayChange(command));
}

function partsThatMayChange(command: string): string[] {
  try {
    return parseShell(command).flatMap(segmentTexts);
  } catch (e) {
    if (e instanceof ShellSyntaxError) return [command];
    throw e;
  }
}

function segmentTexts(segment: ShellSegment): string[] {
  const inner = segment.substitutions.flatMap(partsThatMayChange);
  return isReadOnlySegment(segment) ? inner : [verbText(segment), ...inner];
}

function verbText(segment: ShellSegment): string {
  if (segment.words.some(runsCode)) return [segment.raw, ...segment.stdin].join("\n");
  return segment.words.map((word, i) => (i === 0 ? programName(word.text) : asVerbWord(word))).join(" ");
}

function runsCode(word: ShellWord): boolean {
  return !word.quoted && CODE_RUNNERS.has(programName(word.text));
}

/** ./scripts/deploy.sh runs as deploy.sh. */
function programName(text: string): string {
  return text.slice(text.lastIndexOf("/") + 1);
}

function asVerbWord(word: ShellWord): string {
  return word.quoted || PATH_LIKE.test(word.text) ? DATA : word.text;
}

/** Each text, and the same with git's global options taken out ("git -C repo push" as "git push"). */
function withNormalForm(texts: string[]): string[] {
  return texts.flatMap((text) => [text, normalizeCommand(text)]);
}
