import { execFile } from "node:child_process";
import { statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type { CommandRunner } from "../secrets/keychain.js";
import type { SavedAttachment } from "./attachment-files.js";
import { readableSize } from "./file-size.js";

/** A file attached in the page but too large to upload: the browser tells its name, size and time, never its path. */
export interface FileOnDisk {
  name: string;
  size: number;
  /** When it last changed, in milliseconds since 1970, as the browser reports it. */
  modified: number;
}

const MDFIND_BIN = "/usr/bin/mdfind";
const SPOTLIGHT_TIMEOUT_MS = 10_000;
const SPOTLIGHT_MAX_OUTPUT_BYTES = 16_777_216; // 16 MiB, room for a common name found all over the disk
/** Where a file you attach usually sits, checked too in case Spotlight hasn't indexed it yet. */
const USUAL_FOLDERS = ["Downloads", "Desktop", "Movies", "Documents", "Pictures"];
const spotlightPaths = z.string().transform((stdout) => stdout.split("\n").filter(Boolean));

/** The finder used by the app: Spotlight through `mdfind`, then your usual folders. */
export function spotlightFinder(): DiskFileFinder {
  const run = promisify(execFile);
  const runner: CommandRunner = (file, args) =>
    run(file, args, { timeout: SPOTLIGHT_TIMEOUT_MS, maxBuffer: SPOTLIGHT_MAX_OUTPUT_BYTES });
  const folders = USUAL_FOLDERS.map((folder) => join(homedir(), folder));
  return new DiskFileFinder(runner, folders);
}

/** Finds on this Mac the file you attached, by its exact name and size; the closest change time settles a tie. */
export class DiskFileFinder {
  constructor(
    private run: CommandRunner,
    private folders: string[],
  ) {}

  findAll(files: FileOnDisk[]): Promise<SavedAttachment[]> {
    return Promise.all(files.map((file) => this.find(file)));
  }

  async find(file: FileOnDisk): Promise<SavedAttachment> {
    const candidates = new Set([...(await this.spotlightMatches(file.name)), ...this.folderMatches(file.name)]);
    const matching = [...candidates].filter((path) => DiskFileFinder.hasSize(path, file.size));
    if (!matching.length) throw new Error(DiskFileFinder.notFoundMessage(file));
    const path = DiskFileFinder.closestModified(matching, file.modified);
    return { name: file.name, path, size: file.size };
  }

  /** Spotlight off or failing leaves the usual folders to look in. */
  private async spotlightMatches(name: string): Promise<string[]> {
    try {
      return await this.spotlightPathsNamed(name);
    } catch {
      return [];
    }
  }

  private async spotlightPathsNamed(name: string): Promise<string[]> {
    const { stdout } = await this.run(MDFIND_BIN, ["-name", name]);
    return spotlightPaths.parse(stdout).filter((path) => basename(path) === name);
  }

  private folderMatches(name: string): string[] {
    return this.folders.map((folder) => join(folder, name));
  }

  private static hasSize(path: string, size: number): boolean {
    const stats = statSync(path, { throwIfNoEntry: false });
    return stats?.isFile() === true && stats.size === size;
  }

  private static closestModified(paths: string[], modified: number): string {
    const distance = (path: string): number => Math.abs(statSync(path).mtimeMs - modified);
    return paths.reduce((closest, path) => (distance(path) < distance(closest) ? path : closest));
  }

  private static notFoundMessage(file: FileOnDisk): string {
    return `Couldn't find ${file.name} (${readableSize(file.size)}) on this Mac. Type its full path in the message instead.`;
  }
}
