import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STATE_DIR } from "../config/paths.js";
import { sweepLeftoverShots } from "../screen/leftover-shot-sweep.js";
import { ScreenshotFolder } from "../screen/screenshot-folder.js";
import { TurnShots } from "../screen/turn-shots.js";
import type { SensorSnapshots } from "../sensors/sensor-snapshots.js";
import type { CameraFrame, CameraSource } from "./camera-source.js";

type Snapshots = Pick<SensorSnapshots, "take">;

/**
 * The camera, through the gesture sensor that holds it: frames written to state/camera and deleted once the turn
 * that could look at them is over; leftovers go after an hour. While Gestures are off there are no frames.
 */
export class SensorCamera implements CameraSource {
  private pending?: Promise<CameraFrame>;
  private shots: TurnShots;

  constructor(
    private snapshots: Snapshots,
    private folder: ScreenshotFolder,
  ) {
    this.shots = new TurnShots(folder);
  }

  static create(snapshots: Snapshots): SensorCamera {
    const folder = new ScreenshotFolder(resolve(STATE_DIR, "camera"));
    sweepLeftoverShots(folder);
    return new SensorCamera(snapshots, folder);
  }

  capture(): void {
    this.pending = this.shoot();
    this.pending.catch(() => {}); // a failure (Gestures off) is reported when the model asks for the frame
  }

  /** The frame from the latest key press, or a fresh one if the key was never pressed. */
  latest(): Promise<CameraFrame> {
    return this.pending ?? this.shoot();
  }

  releaseShotsBefore(time: number): void {
    this.shots.releaseBefore(time);
  }

  private shoot(): Promise<CameraFrame> {
    const takenAt = Date.now();
    const file = this.folder.pathFor(new Date(takenAt));
    const written = this.write(file);
    this.shots.add({ file, takenAt, written });
    return written;
  }

  private async write(file: string): Promise<CameraFrame> {
    await this.snapshots.take(file);
    return { data: readFileSync(file).toString("base64"), mimeType: "image/jpeg" };
  }
}
