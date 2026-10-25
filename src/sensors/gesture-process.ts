import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { CrashBackoff } from "../orchestrator/model/crash-backoff.js";
import { errorMessage } from "../shared/errors.js";
import { readSensorLine, type SensorEvent } from "./sensor-event.js";
import type { SensorListener } from "./sensor-router.js";

const LOG = "[gestures]";
const SECOND_MS = 1000;
const SETUP_HINT = "Set up sensors/gestures as its README says, or fix sensors.gestures in config/config.yaml.";

/** How the sensor is started: the interpreter and what follows it. */
export interface SensorCommand {
  bin: string;
  args: string[];
}

export type RestartBackoff = Pick<CrashBackoff, "nextDelay" | "reset">;

/**
 * Runs the gesture sensor and reads its JSON lines; its logs go straight to stderr.
 * If it dies it is started again, waiting longer each time until it gets as far as `ready`.
 */
export class GestureProcess {
  private child?: ChildProcess;
  private restart?: NodeJS.Timeout;
  private stopped = false;

  constructor(
    private command: SensorCommand,
    private listener: SensorListener,
    private backoff: RestartBackoff = new CrashBackoff(),
  ) {}

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

  private launch(): void {
    const child = spawn(this.command.bin, this.command.args, { stdio: ["ignore", "pipe", "inherit"] });
    const kill = (): void => void child.kill();
    process.once("exit", kill); // the app crashing must not leave the camera on
    child.on("error", (e) => console.error(`${LOG} ${errorMessage(e)}. ${SETUP_HINT}`));
    child.once("close", (code) => {
      process.off("exit", kill);
      this.closed(code);
    });
    createInterface({ input: child.stdout }).on("line", (line) => this.read(line));
    this.child = child;
  }

  private read(line: string): void {
    if (this.stopped) return;
    const parsed = readSensorLine(line);
    if (parsed.success) this.handle(parsed.data);
    else console.error(`${LOG} skipped a line it couldn't read: ${line}`);
  }

  private handle(event: SensorEvent): void {
    switch (event.type) {
      case "ready":
        console.log(`${LOG} on (${event.recognizer} recognizer)`);
        return this.backoff.reset();
      case "error":
        return console.error(`${LOG} ${event.message}`);
      case "gesture":
        console.log(`${LOG} ${event.name} ${event.phase} (${event.hand} hand)`);
        return this.listener.receive(event);
    }
  }

  private closed(code: number | null): void {
    this.listener.sensorStopped();
    if (this.stopped) return;
    const delay = this.backoff.nextDelay();
    console.error(`${LOG} the sensor stopped (exit code ${String(code)}); starting it again in ${delay / SECOND_MS}s.`);
    this.restart = setTimeout(() => this.launch(), delay);
  }
}
