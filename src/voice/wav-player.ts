import { spawn, type ChildProcess } from "node:child_process";

/** Plays one audio file at a time; stopping cuts it off. */
export interface AudioPlayer {
  play(path: string): Promise<void>;
  stop(): void;
}

/** macOS `afplay`, as the recording sounds use. */
export class AfplayPlayer implements AudioPlayer {
  private playing?: ChildProcess;

  play(path: string): Promise<void> {
    const afplay = spawn("afplay", [path], { stdio: "ignore" });
    this.playing = afplay;
    return new Promise((resolve) => afplay.once("close", () => resolve()));
  }

  stop(): void {
    this.playing?.kill();
    this.playing = undefined;
  }
}
