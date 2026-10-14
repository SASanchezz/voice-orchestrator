// Which git commands only look: status, diffs, logs, listings. Anything else may change the repo or a remote.

type GitCheck = (args: string[]) => boolean;

/** Global options that take a value, as in git -C repo status. */
const GLOBAL_OPTIONS_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env"]);
const BRANCH_CHANGES = new Set([
  "-d", "-D", "--delete", "-m", "-M", "--move", "-c", "-C", "--copy", "-f", "--force", "-u", "-t", "--track",
  "--set-upstream-to", "--unset-upstream", "--edit-description",
]); // prettier-ignore
/** With these, names after `git branch` are patterns or commits to list by, not branches to create. */
const BRANCH_LISTING = new Set([
  "--list",
  "-l",
  "--merged",
  "--no-merged",
  "--contains",
  "--no-contains",
  "--points-at",
]);
const TAG_CHANGES = new Set(["-d", "--delete", "-a", "--annotate", "-s", "--sign", "-f", "--force", "-m", "-F", "-u"]);
const CONFIG_READS = new Set(["--get", "--get-all", "--get-regexp", "--get-urlmatch", "--list", "-l"]);
const CONFIG_CHANGES = new Set(["--unset", "--unset-all", "--add", "--replace-all", "--rename-section", "--remove-section", "-e", "--edit"]); // prettier-ignore

const always: GitCheck = () => true;
/** --output writes the diff or log to a file. */
const withoutOutputFile: GitCheck = (args) => !args.some((arg) => arg === "--output" || arg.startsWith("--output="));
const firstIs =
  (...subcommands: string[]): GitCheck =>
  (args) =>
    subcommands.includes(args[0]);

const SUBCOMMANDS = new Map<string, GitCheck>([
  ...[
    "status", "rev-list", "rev-parse", "ls-files", "ls-tree", "ls-remote", "check-ignore", "check-attr", "blame",
    "annotate", "describe", "shortlog", "cat-file", "grep", "merge-base", "name-rev", "for-each-ref", "show-ref",
    "count-objects", "cherry", "whatchanged", "version", "help",
  ].map((name): [string, GitCheck] => [name, always]),
  ...["diff", "log", "show", "diff-tree", "diff-files", "diff-index", "range-diff"].map(
    (name): [string, GitCheck] => [name, withoutOutputFile],
  ),
  ["branch", listsBranches],
  ["tag", (args) => !args.length || (hasAny(args, ["-l", "--list"]) && !hasAny(args, [...TAG_CHANGES]))],
  ["remote", (args) => !args.length || ["-v", "--verbose", "show", "get-url"].includes(args[0])],
  ["stash", firstIs("list", "show")],
  ["worktree", firstIs("list")],
  ["notes", firstIs("list", "show")],
  ["submodule", firstIs("status")],
  ["reflog", (args) => !args.length || args[0] === "show"],
  ["config", (args) => hasAny(args, [...CONFIG_READS]) && !hasAny(args, [...CONFIG_CHANGES])],
]); // prettier-ignore

export function isReadOnlyGit(args: string[]): boolean {
  const [subcommand, ...rest] = withoutGlobalOptions(args);
  return SUBCOMMANDS.get(subcommand)?.(rest) ?? false;
}

/** What follows the options git itself takes before the subcommand. */
function withoutGlobalOptions(args: string[]): string[] {
  let i = 0;
  while (i < args.length && args[i].startsWith("-")) i += GLOBAL_OPTIONS_WITH_VALUE.has(args[i]) ? 2 : 1;
  return args.slice(i);
}

/** `git branch` lists unless it is given a branch to create, delete, move or track. */
function listsBranches(args: string[]): boolean {
  if (args.some((arg) => BRANCH_CHANGES.has(arg.split("=")[0]))) return false;
  return hasAny(args, [...BRANCH_LISTING]) || args.every((arg) => arg.startsWith("-"));
}

function hasAny(args: string[], options: string[]): boolean {
  return args.some((arg) => options.includes(arg.split("=")[0]));
}
