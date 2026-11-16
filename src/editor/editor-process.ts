import type { ChildProcess } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { isListening } from "./port-probe.js";
import { isAlive, stopGroup } from "./process-group.js";

const PORT_POLL_MS = 250;
const EXIT_POLL_MS = 2000;

export type ExitListener = (code: number | null) => void;

/** The editor server's process group, while the app watches it. */
export interface EditorProcess {
  readonly pid?: number;
  /** Settles once the server takes connections on its port. */
  readonly ready: Promise<void>;
  onExit(listener: ExitListener): void;
  /** Stops watching it, so it carries on running after the app exits. */
  release(): void;
  /** Stops it and whatever it started. */
  stop(): void;
}

abstract class WatchedEditor implements EditorProcess {
  readonly ready: Promise<void>;
  private watching = true;
  private readonly stopOnAppExit = (): void => this.stop();

  constructor(
    readonly pid: number | undefined,
    port: number,
  ) {
    process.once("exit", this.stopOnAppExit); // the app crashing must not leave the editor's port taken
    this.ready = this.waitUntilListening(port);
  }

  abstract onExit(listener: ExitListener): void;

  release(): void {
    this.watching = false;
    process.off("exit", this.stopOnAppExit);
  }

  stop(): void {
    this.release();
    stopGroup(this.pid);
  }

  /** What it started may outlive it, so its group is stopped too. */
  protected exited(listener: ExitListener, code: number | null): void {
    this.stop();
    listener(code);
  }

  private async waitUntilListening(port: number): Promise<void> {
    while (this.watching && !(await isListening(port))) await sleep(PORT_POLL_MS);
  }
}

/** Started by this app, which hears when it exits. */
export class SpawnedEditor extends WatchedEditor {
  constructor(
    private readonly child: ChildProcess,
    port: number,
  ) {
    super(child.pid, port);
  }

  onExit(listener: ExitListener): void {
    this.child.once("exit", (code) => this.exited(listener, code));
  }
}

/** Kept running over a restart: not this app's child, so it is checked on now and then instead. */
export class KeptEditor extends WatchedEditor {
  private exitPoll?: NodeJS.Timeout;

  onExit(listener: ExitListener): void {
    this.exitPoll = setInterval(() => this.checkAlive(listener), EXIT_POLL_MS);
  }

  override release(): void {
    clearInterval(this.exitPoll);
    super.release();
  }

  private checkAlive(listener: ExitListener): void {
    if (this.pid !== undefined && isAlive(this.pid)) return;
    this.exited(listener, null);
  }
}
