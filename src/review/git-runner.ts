import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const OUTPUT_LIMIT_BYTES = 8_388_608; // 8 MiB
const TOPLEVEL = ["rev-parse", "--show-toplevel"];

export type GitRunner = (folder: string, args: string[]) => Promise<string>;

/** Optional locks are off, so reading never gets in the way of a worker's own git commands. */
export async function runGit(folder: string, args: string[]): Promise<string> {
  const options = { cwd: folder, maxBuffer: OUTPUT_LIMIT_BYTES };
  const command = ["--no-optional-locks", "--literal-pathspecs", ...args];
  const { stdout } = await run("git", command, options);
  return stdout;
}

/** Empty when the folder isn't in a repository. */
export async function repositoryRootOf(git: GitRunner, folder: string): Promise<string> {
  if (!folder) return "";
  try {
    return (await git(folder, TOPLEVEL)).trim();
  } catch {
    return "";
  }
}
