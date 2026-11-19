import { setTimeout as sleep } from "node:timers/promises";
import type { EditorStateName } from "../ui/protocol.js";
import type { Editor, RestartableEditor } from "./editor.js";
import { isListening } from "./port-probe.js";

const POLL_MS = 250;
/** Stopping lets the old server shut down; one still on the port after this is left to the new one's start to fail. */
const PORT_RELEASE_TIMEOUT_MS = 10_000;

export type PortProbe = (port: number) => Promise<boolean>;

/**
 * The editor server, restartable by hand: a long-running one can end up unable to start its extension hosts, so
 * Markdown preview and other extensions stop working until a new one runs. While it restarts, its status says so,
 * so the open pages drop their frames, which can't reconnect to a new server.
 */
export class EditorRestarter implements RestartableEditor {
  private restarting = false;

  constructor(
    private readonly server: Editor,
    private readonly port: number,
    private readonly isPortTaken: PortProbe = isListening,
  ) {}

  get status(): EditorStateName {
    return this.restarting ? "restarting" : this.server.status;
  }

  start(): void {
    this.server.start();
  }

  stop(): void {
    this.server.stop();
  }

  keepRunning(): void {
    this.server.keepRunning();
  }

  /** Stops the running server and what it started, then starts a new one once the port is free. */
  async restart(): Promise<void> {
    if (this.restarting) return;
    this.restarting = true;
    try {
      await this.replaceServer();
    } finally {
      this.restarting = false;
    }
  }

  private async replaceServer(): Promise<void> {
    this.server.stop();
    await this.untilPortReleased();
    this.server.start();
    while (this.server.status === "starting") await sleep(POLL_MS);
  }

  private async untilPortReleased(): Promise<void> {
    const deadline = Date.now() + PORT_RELEASE_TIMEOUT_MS;
    while (await this.isPortStillTaken(deadline)) await sleep(POLL_MS);
  }

  private async isPortStillTaken(deadline: number): Promise<boolean> {
    if (Date.now() >= deadline) return false;
    return this.isPortTaken(this.port);
  }
}
