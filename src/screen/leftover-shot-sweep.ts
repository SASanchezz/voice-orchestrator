import type { ScreenshotFolder } from "./screenshot-folder.js";

/** Snapshots left behind, by a crash or a turn that failed, are deleted once they are this old. */
export const LEFTOVER_SHOT_MAX_AGE_MS = 3_600_000; // one hour
const SWEEP_EVERY_MS = 600_000; // ten minutes

/** Deletes leftover snapshots now, and again every ten minutes while the app runs. */
export function sweepLeftoverShots(folder: ScreenshotFolder): void {
  const sweep = () => folder.removeOlderThan(Date.now() - LEFTOVER_SHOT_MAX_AGE_MS);
  sweep();
  setInterval(sweep, SWEEP_EVERY_MS).unref();
}
