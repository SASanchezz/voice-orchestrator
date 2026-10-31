import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { namesSecretFile } from "../safety/secret-files.js";
import { errorMessage } from "../shared/errors.js";
import type { ChangedFileView, FileDiffView, ProjectChangesView } from "../ui/change-views.js";
import { expansionOf, fingerprintOf, MAX_FILE_BYTES, readLines, StaleFileError } from "./file-lines.js";
import { parseNumstat, parseStatus, patchAddingFile, type StatusEntry } from "./git-output.js";
import { repositoryRootOf, runGit, type GitRunner } from "./git-runner.js";

/** Beyond these, the list and a diff would only slow the page down; VS Code still opens them. */
const MAX_LISTED_FILES = 300;
const MAX_PATCH_BYTES = MAX_FILE_BYTES;

const STATUS = ["status", "--porcelain", "--no-renames", "--untracked-files=all", "-z"];
const NUMSTAT = ["diff", "HEAD", "--numstat", "--no-renames", "-z"];
const PATCH = ["diff", "HEAD", "--no-ext-diff", "--no-color", "--no-renames"];

const SECRET_NOT_SHOWN = "This looks like a secrets file, so its diff isn't shown here.";
const TOO_LARGE_NOT_SHOWN = "This diff is too large to show here.";
const BINARY_NOT_SHOWN = "Binary file.";
const STALE_LINES = "This file changed since its diff loaded. Refresh to see these lines.";

/** Which lines of a file to read, and the fingerprint of the file the page's diff came from. */
export interface LinesRequest {
  from: number;
  to: number;
  fingerprint: string;
}

/** A project's uncommitted changes, read from git; the only thing it ever writes is the staged state of a file. */
export class GitChanges {
  constructor(private git: GitRunner = runGit) {}

  async ofProject(project: string, folder: string): Promise<ProjectChangesView> {
    const root = await repositoryRootOf(this.git, folder);
    if (!root) return { project, isRepository: false, files: [], moreFiles: 0 };
    const entries = await this.statusOf(root);
    const counts = parseNumstat(await this.numstatOf(root));
    const files = await Promise.all(entries.slice(0, MAX_LISTED_FILES).map((e) => describe(root, e, counts)));
    return { project, isRepository: true, files, moreFiles: entries.length - files.length };
  }

  async isChanged(folder: string, path: string): Promise<boolean> {
    const root = await repositoryRootOf(this.git, folder);
    if (!root) return false;
    return (await this.statusOf(root)).some((entry) => entry.path === path);
  }

  async diffOf(folder: string, path: string): Promise<FileDiffView> {
    if (namesSecretFile(path)) return notShown(path, SECRET_NOT_SHOWN);
    const root = await repositoryRootOf(this.git, folder);
    if (!root) return notShown(path, "Not a git repository.");
    try {
      const expansion = await expansionOf(join(root, path));
      const patch = await this.patchOf(root, path);
      return patch.length > MAX_PATCH_BYTES ? notShown(path, TOO_LARGE_NOT_SHOWN) : { path, patch, expansion };
    } catch (e) {
      return notShown(path, errorMessage(e));
    }
  }

  async stage(folder: string, path: string): Promise<void> {
    const root = await repositoryRootOf(this.git, folder);
    if (root) await this.git(root, ["add", "--", path]);
  }

  /** The lines a diff left out; secret files stay as closed as their diffs. */
  async hiddenLines(folder: string, path: string, request: LinesRequest): Promise<string[]> {
    if (namesSecretFile(path)) throw new Error(SECRET_NOT_SHOWN);
    const file = join(await repositoryRootOf(this.git, folder), path);
    if ((await fingerprintOf(file)) !== request.fingerprint) throw new StaleFileError(STALE_LINES);
    return (await readLines(file)).slice(request.from - 1, request.to);
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

async function patchOfUntracked(file: string): Promise<string> {
  if ((await stat(file)).size > MAX_PATCH_BYTES) throw new Error(TOO_LARGE_NOT_SHOWN);
  const text = await readFile(file, "utf8");
  if (text.includes("\0")) throw new Error(BINARY_NOT_SHOWN);
  return patchAddingFile(text);
}

function notShown(path: string, notShownReason: string): FileDiffView {
  return { path, patch: "", notShownReason };
}
