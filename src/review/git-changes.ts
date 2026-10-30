import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { namesSecretFile } from "../safety/secret-files.js";
import { errorMessage } from "../shared/errors.js";
import type { ChangedFileView, FileDiffView, ProjectChangesView } from "../ui/change-views.js";
import { parseNumstat, parseStatus, patchAddingFile, type StatusEntry } from "./git-output.js";

const run = promisify(execFile);

/** Beyond these, the list and a diff would only slow the page down; VS Code still opens them. */
const MAX_LISTED_FILES = 300;
const MAX_PATCH_BYTES = 262_144; // 256 KiB
const OUTPUT_LIMIT_BYTES = 8_388_608; // 8 MiB

const STATUS = ["status", "--porcelain", "--no-renames", "--untracked-files=all", "-z"];
const NUMSTAT = ["diff", "HEAD", "--numstat", "--no-renames", "-z"];
const PATCH = ["diff", "HEAD", "--no-ext-diff", "--no-color", "--no-renames"];
const TOPLEVEL = ["rev-parse", "--show-toplevel"];

const SECRET_NOT_SHOWN = "This looks like a secrets file, so its diff isn't shown here.";
const TOO_LARGE_NOT_SHOWN = "This diff is too large to show here.";
const BINARY_NOT_SHOWN = "Binary file.";

export type GitRunner = (folder: string, args: string[]) => Promise<string>;

/** A project's uncommitted changes, read from git; the only thing it ever writes is the staged state of a file. */
export class GitChanges {
  constructor(private git: GitRunner = runGit) {}

  async ofProject(project: string, folder: string): Promise<ProjectChangesView> {
    const root = await this.repositoryRoot(folder);
    if (!root) return { project, isRepository: false, files: [], moreFiles: 0 };
    const entries = await this.statusOf(root);
    const counts = parseNumstat(await this.numstatOf(root));
    const files = await Promise.all(entries.slice(0, MAX_LISTED_FILES).map((e) => describe(root, e, counts)));
    return { project, isRepository: true, files, moreFiles: entries.length - files.length };
  }

  async isChanged(folder: string, path: string): Promise<boolean> {
    const root = await this.repositoryRoot(folder);
    if (!root) return false;
    return (await this.statusOf(root)).some((entry) => entry.path === path);
  }

  async diffOf(folder: string, path: string): Promise<FileDiffView> {
    if (namesSecretFile(path)) return notShown(path, SECRET_NOT_SHOWN);
    const root = await this.repositoryRoot(folder);
    if (!root) return notShown(path, "Not a git repository.");
    try {
      const patch = await this.patchOf(root, path);
      return patch.length > MAX_PATCH_BYTES ? notShown(path, TOO_LARGE_NOT_SHOWN) : { path, patch };
    } catch (e) {
      return notShown(path, errorMessage(e));
    }
  }

  async stage(folder: string, path: string): Promise<void> {
    const root = await this.repositoryRoot(folder);
    if (root) await this.git(root, ["add", "--", path]);
  }

  /** Empty when the folder isn't in a repository. */
  private async repositoryRoot(folder: string): Promise<string> {
    if (!folder) return "";
    try {
      return (await this.git(folder, TOPLEVEL)).trim();
    } catch {
      return "";
    }
  }

  private async statusOf(root: string): Promise<StatusEntry[]> {
    return parseStatus(await this.git(root, STATUS));
  }

  /** A repository with no commits has no HEAD to compare with. */
  private async numstatOf(root: string): Promise<string> {
    try {
      return await this.git(root, NUMSTAT);
    } catch {
      return "";
    }
  }

  /** Git has nothing to say about a file it doesn't track, so that one is read directly. */
  private async patchOf(root: string, path: string): Promise<string> {
    const tracked = await this.git(root, [...PATCH, "--", path]).catch(() => "");
    return tracked || patchOfUntracked(join(root, path));
  }
}

async function describe(
  root: string,
  entry: StatusEntry,
  counts: ReturnType<typeof parseNumstat>,
): Promise<ChangedFileView> {
  const { additions = 0, deletions = 0 } = counts.get(entry.path) ?? {};
  return { ...entry, additions, deletions, fingerprint: await fingerprintOf(join(root, entry.path)) };
}

/** Size and time are enough to notice a file changing again, without reading it. */
async function fingerprintOf(file: string): Promise<string> {
  try {
    const { mtimeMs, size } = await stat(file);
    return `${mtimeMs}-${size}`;
  } catch {
    return "gone";
  }
}

async function patchOfUntracked(file: string): Promise<string> {
  if ((await stat(file)).size > MAX_PATCH_BYTES) throw new Error(TOO_LARGE_NOT_SHOWN);
  const text = await readFile(file, "utf8");
  if (text.includes("\0")) throw new Error(BINARY_NOT_SHOWN);
  return patchAddingFile(text);
}

function notShown(path: string, notShownReason: string): FileDiffView {
  return { path, patch: "", notShownReason };
}

/** Optional locks are off, so reading never gets in the way of a worker's own git commands. */
async function runGit(folder: string, args: string[]): Promise<string> {
  const options = { cwd: folder, maxBuffer: OUTPUT_LIMIT_BYTES };
  const command = ["--no-optional-locks", "--literal-pathspecs", ...args];
  const { stdout } = await run("git", command, options);
  return stdout;
}
