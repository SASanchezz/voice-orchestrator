import type { ScreenshotFolder } from "./screenshot-folder.js";

/** A snapshot being written or written: its file, when it was taken, and the write, which may fail. */
export interface TakenShot {
  file: string;
  takenAt: number;
  written: Promise<unknown>;
}

/**
 * Snapshot files kept until the turn that may look at them is over. The model gets a snapshot's pixels, not its
 * file, and nothing else reads the file, so it can go as soon as that turn's reply is finished.
 */
export class TurnShots {
  private shots: TakenShot[] = [];

  constructor(private folder: ScreenshotFolder) {}

  add(shot: TakenShot): void {
    this.shots.push(shot);
  }

  /** Deletes the files of the snapshots taken before `time`, each once it is written; later ones wait for their turn. */
  releaseBefore(time: number): void {
    const released = this.shots.filter((shot) => shot.takenAt < time);
    this.shots = this.shots.filter((shot) => shot.takenAt >= time);
    for (const { file, written } of released) {
      const remove = () => this.folder.remove(file);
      void written.then(remove, remove);
    }
  }
}
