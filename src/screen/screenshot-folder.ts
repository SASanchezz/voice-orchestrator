import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, type Stats } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

/** "2026-10-14T09-12-30-123Z.jpg": the name this app gives a snapshot, from the time it was taken. */
const SHOT_NAME = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.jpg$/;

/**
 * state/screenshots: the snapshots this app took. It deletes only regular files in this folder with the names
 * it gives its snapshots, so anything else put there, a subfolder or a link, is left alone.
 */
export class ScreenshotFolder {
  private dir: string;

  constructor(dir: string) {
    this.dir = resolve(dir);
    mkdirSync(this.dir, { recursive: true });
  }

  pathFor(takenAt: Date): string {
    return join(this.dir, `${takenAt.toISOString().replace(/[:.]/g, "-")}.jpg`);
  }

  remove(path: string): void {
    if (this.ownShotStats(resolve(path))) rmSync(path, { force: true });
  }

  /** Deletes the snapshots last written before `cutoff` (ms since the epoch). */
  removeOlderThan(cutoff: number): void {
    const names = existsSync(this.dir) ? readdirSync(this.dir) : [];
    for (const path of names.map((name) => join(this.dir, name))) {
      const stats = this.ownShotStats(path);
      if (stats && stats.mtimeMs < cutoff) rmSync(path, { force: true });
    }
  }

  /** The file's stats if it is one of this app's snapshots, which may have been deleted meanwhile. */
  private ownShotStats(path: string): Stats | undefined {
    if (dirname(path) !== this.dir || !SHOT_NAME.test(basename(path))) return undefined;
    const stats = lstatSync(path, { throwIfNoEntry: false });
    return stats?.isFile() ? stats : undefined;
  }
}
