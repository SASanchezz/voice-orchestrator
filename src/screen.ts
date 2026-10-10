import { execFile } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { STATE_DIR } from "./config.js";
import { buildNativeHelper } from "./native.js";

const run = promisify(execFile);

const SCREEN_RECORDING_MISSING_EXIT_CODE = 2;
const RETENTION_MS = 24 * 60 * 60_000;
/** Longest edge Claude's vision uses without downscaling; anything bigger only costs tokens. */
const MAX_EDGE_PX = 1568;

export interface Screenshot {
  data: string; // base64
  mimeType: "image/jpeg";
}

/** Snaps the screen when you start talking, and hands that snapshot over when the model asks for it. */
export interface ScreenSource {
  capture(): void;
  latest(): Promise<Screenshot>;
}

/** macOS: screenshot of the display under the cursor, kept in state/screenshots for a day. */
export class MacScreen implements ScreenSource {
  private pending?: Promise<Screenshot>;

  private constructor(
    private helperPath: string,
    private dir: string,
  ) {}

  static async create(): Promise<MacScreen> {
    const dir = resolve(STATE_DIR, "screenshots");
    mkdirSync(dir, { recursive: true });
    return new MacScreen(await buildNativeHelper("cursor-display"), dir);
  }

  capture() {
    this.pending = this.shoot();
    this.pending.catch(() => {}); // a failure is reported when the model asks for the screenshot, not on every key press
  }

  /** The snapshot from the latest key press, or a fresh one if the key was never pressed. */
  latest(): Promise<Screenshot> {
    return this.pending ?? this.shoot();
  }

  private async shoot(): Promise<Screenshot> {
    const file = join(this.dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`);
    await run("screencapture", ["-x", "-t", "jpg", `-R${await this.displayUnderCursor()}`, file]);
    await run("sips", ["-Z", String(MAX_EDGE_PX), file]);
    this.deleteExpired();
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

  private deleteExpired() {
    const cutoff = Date.now() - RETENTION_MS;
    for (const name of readdirSync(this.dir)) {
      const path = join(this.dir, name);
      if (statSync(path).mtimeMs < cutoff) rmSync(path, { force: true });
    }
  }
}

function isScreenRecordingMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === SCREEN_RECORDING_MISSING_EXIT_CODE;
}

function screenRecordingError() {
  return new Error(
    "Screen Recording permission is missing for the terminal app. Turn it on in System Settings > Privacy & Security > " +
      "Screen & System Audio Recording, then fully quit and reopen the terminal.",
  );
}
