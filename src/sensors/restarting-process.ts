import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import type { CrashBackoff } from "../orchestrator/model/crash-backoff.js";
import { errorMessage } from "../shared/errors.js";

const SECOND_MS = 1000;

/** How a sensor is started: the interpreter and what follows it. */
export interface SensorCommand {
  bin: string;
  args: string[];
}

/** The same, with how its log lines start ("[gestures]") and what to do when it can't be started at all. */
export interface NamedSensorCommand extends SensorCommand {
  log: string;
  setupHint: string;
}

export type RestartBackoff = Pick<CrashBackoff, "nextDelay" | "reset">;

/** What the process prints, line by line, and that it stopped. */
export interface ProcessOutput {
  line(text: string): void;
  stopped(): void;
}

/**
 * Runs a sensor and reads its stdout lines; its logs go straight to stderr. If it dies it is started again,
 * waiting longer each time until whoever owns `backoff` resets it. It is killed when the app exits, so it never keeps
 * the camera or the mic on.
 */
export class RestartingProcess {
  private child?: ChildProcess;
  private restart?: NodeJS.Timeout;
  private stopped = false;

  constructor(
    private command: NamedSensorCommand,
    private output: ProcessOutput,
    private backoff: RestartBackoff,
  ) {}

  start(): void {
    this.stopped = false;
    this.launch();
  }

  /** For good: nothing it still prints is passed on, and it isn't started again. */
  stop(): void {
    this.stopped = true;
    clearTimeout(this.restart);
    this.child?.kill("SIGTERM");
  }

  isRunning(): boolean {
    return !this.stopped && Boolean(this.child?.stdin);
  }

  send(line: string): void {
    this.child?.stdin?.write(`${line}\n`);
  }

  private launch(): void {
    const { bin, args, log, setupHint } = this.command;
    const child = spawn(bin, args, { stdio: ["pipe", "pipe", "inherit"] });
    const kill = (): void => void child.kill();
    process.once("exit", kill); // the app crashing must not leave the camera or mic on
    child.on("error", (e) => console.error(`${log} ${errorMessage(e)}. ${setupHint}`));
    child.stdin.on("error", () => {}); // a line to a dying sensor goes unanswered; stopped() covers that
    child.once("close", (code) => {
      process.off("exit", kill);
      if (this.child === child) this.child = undefined;
      this.closed(code);
    });
    createInterface({ input: child.stdout }).on("line", (line) => this.read(line));
    this.child = child;
  }

  private read(line: string): void {
    if (!this.stopped) this.output.line(line);
  }

  private closed(code: number | null): void {
    this.output.stopped();
    if (this.stopped) return;
    const delay = this.backoff.nextDelay();
    const { log } = this.command;
    console.error(`${log} the sensor stopped (exit code ${String(code)}); starting it again in ${delay / SECOND_MS}s.`);
    this.restart = setTimeout(() => this.launch(), delay);
  }
}
