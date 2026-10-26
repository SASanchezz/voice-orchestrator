import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { CrashBackoff } from "../orchestrator/model/crash-backoff.js";
import { errorMessage } from "../shared/errors.js";
import { SensorLines, type SensorOutput } from "./sensor-lines.js";

const LOG = "[gestures]";
const SECOND_MS = 1000;
const SETUP_HINT = "Set up sensors/gestures as its README says, or fix sensors.gestures in config/config.yaml.";
export const CAMERA_OFF = "The camera is off: it runs only while Gestures are on in the web UI.";

/** How the sensor is started: the interpreter and what follows it. */
export interface SensorCommand {
  bin: string;
  args: string[];
}

export type RestartBackoff = Pick<CrashBackoff, "nextDelay" | "reset">;

/** Asks for a JPEG of the camera's next frame at `path`, answered by a `snapshot` line with the same `id`. */
export interface SnapshotRequest {
  id: string;
  path: string;
}

/**
 * Runs the gesture sensor and reads its JSON lines; its logs go straight to stderr.
 * If it dies it is started again, waiting longer each time until it gets as far as `ready`.
 * Commands such as snapshot requests go to its stdin.
 */
export class GestureProcess {
  private child?: ChildProcess;
  private restart?: NodeJS.Timeout;
  private stopped = false;
  private lines: SensorLines;

  constructor(
    private command: SensorCommand,
    private output: SensorOutput,
    private backoff: RestartBackoff = new CrashBackoff(),
  ) {
    this.lines = new SensorLines(output, () => this.backoff.reset());
  }

  start(): void {
    this.stopped = false;
    this.launch();
  }

  /** For good: nothing it still prints is acted on, and it isn't started again. */
  stop(): void {
    this.stopped = true;
    clearTimeout(this.restart);
    this.child?.kill("SIGTERM");
  }

  /** Throws while the sensor isn't running: stopped, or waiting to be started again. */
  requestSnapshot(request: SnapshotRequest): void {
    const input = this.child?.stdin;
    if (this.stopped || !input) throw new Error(CAMERA_OFF);
    input.write(`${JSON.stringify({ cmd: "snapshot", ...request })}\n`);
  }

  private launch(): void {
    const child = spawn(this.command.bin, this.command.args, { stdio: ["pipe", "pipe", "inherit"] });
    const kill = (): void => void child.kill();
    process.once("exit", kill); // the app crashing must not leave the camera on
    child.on("error", (e) => console.error(`${LOG} ${errorMessage(e)}. ${SETUP_HINT}`));
    child.stdin.on("error", () => {}); // a command to a dying sensor goes unanswered; sensorStopped covers that
    child.once("close", (code) => {
      process.off("exit", kill);
      if (this.child === child) this.child = undefined;
      this.closed(code);
    });
    createInterface({ input: child.stdout }).on("line", (line) => this.read(line));
    this.child = child;
  }

  private read(line: string): void {
    if (!this.stopped) this.lines.read(line);
  }

  private closed(code: number | null): void {
    this.output.sensorStopped();
    if (this.stopped) return;
    const delay = this.backoff.nextDelay();
    console.error(`${LOG} the sensor stopped (exit code ${String(code)}); starting it again in ${delay / SECOND_MS}s.`);
    this.restart = setTimeout(() => this.launch(), delay);
  }
}
