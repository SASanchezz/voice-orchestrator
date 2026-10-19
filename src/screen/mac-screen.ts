import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { STATE_DIR } from "../config/paths.js";
import { buildNativeHelper } from "../macos/native-helper.js";
import { sweepLeftoverShots } from "./leftover-shot-sweep.js";
import type { Screenshot, ScreenSource } from "./screen-source.js";
import { ScreenshotFolder } from "./screenshot-folder.js";
import { TurnShots } from "./turn-shots.js";

const run = promisify(execFile);

const SCREEN_RECORDING_MISSING_EXIT_CODE = 2;
/** Longest edge Claude's vision uses without downscaling; anything bigger only costs tokens. */
const MAX_EDGE_PX = 1568;

/**
 * macOS: screenshot of the display under the cursor, written to state/screenshots and deleted once the turn that
 * could look at it is over; leftovers go after an hour.
 */
export class MacScreen implements ScreenSource {
  private pending?: Promise<Screenshot>;
  private shots: TurnShots;

  private constructor(
    private helperPath: string,
    private folder: ScreenshotFolder,
  ) {
    this.shots = new TurnShots(folder);
  }

  static async create(): Promise<MacScreen> {
    const folder = new ScreenshotFolder(resolve(STATE_DIR, "screenshots"));
    sweepLeftoverShots(folder);
    return new MacScreen(await buildNativeHelper("cursor-display"), folder);
  }

  capture(): void {
    this.pending = this.shoot();
    this.pending.catch(() => {}); // a failure is reported when the model asks for the screenshot, not on every key press
  }

  /** The snapshot from the latest key press, or a fresh one if the key was never pressed. */
  latest(): Promise<Screenshot> {
    return this.pending ?? this.shoot();
  }

  releaseShotsBefore(time: number): void {
    this.shots.releaseBefore(time);
  }

  private shoot(): Promise<Screenshot> {
    const takenAt = Date.now();
    const file = this.folder.pathFor(new Date(takenAt));
    const written = this.write(file);
    this.shots.add({ file, takenAt, written });
    return written;
  }

  private async write(file: string): Promise<Screenshot> {
    await run("screencapture", ["-x", "-t", "jpg", `-R${await this.displayUnderCursor()}`, file]);
    await run("sips", ["-Z", String(MAX_EDGE_PX), file]);
    return { data: readFileSync(file).toString("base64"), mimeType: "image/jpeg" };
  }

  private async displayUnderCursor(): Promise<string> {
    try {
      const { stdout } = await run(this.helperPath);
      return stdout.trim();
    } catch (e) {
      throw isScreenRecordingMissing(e) ? screenRecordingError() : e;
    }
  }
}

function isScreenRecordingMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === SCREEN_RECORDING_MISSING_EXIT_CODE;
}

function screenRecordingError(): Error {
  return new Error(
    "Screen Recording permission is missing for the terminal app. Turn it on in System Settings > Privacy & Security > " +
      "Screen & System Audio Recording, then fully quit and reopen the terminal.",
  );
}
