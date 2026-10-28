import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import type { EditorSettings } from "../config/editor-config.js";
import { CrashBackoff } from "../orchestrator/model/crash-backoff.js";
import { errorMessage } from "../shared/errors.js";
import type { EditorStateName } from "../ui/protocol.js";
import type { Editor } from "./editor.js";
import { EDITOR_BASE_PATH } from "./editor-url.js";

const LOG = "[editor]";
const SECOND_MS = 1000;
/** What serve-web prints once it listens. The line carries the token too, so it isn't logged. */
const READY_LINE = "Web UI available";
const SETUP_HINT = "Install VS Code, or fix editor.codePath in config/config.yaml.";

/** How the editor server is started: the VS Code CLI and what follows it. */
export interface EditorCommand {
  bin: string;
  args: string[];
}

/** The started process, as much of it as EditorServer uses. */
export interface EditorChild {
  readonly pid?: number;
  readonly stdout: Readable | null;
  on(event: "error", listener: (error: Error) => void): this;
  once(event: "exit", listener: (code: number | null) => void): this;
}

export type LaunchEditor = (command: EditorCommand) => EditorChild;
export type RestartBackoff = Pick<CrashBackoff, "nextDelay" | "reset">;

/** `code serve-web` on 127.0.0.1, under the editor's base path, with the web UI's token as its connection token. */
export function editorCommand({ codePath, port }: EditorSettings, tokenFile: string): EditorCommand {
  const listen = ["--host", "127.0.0.1", "--port", String(port), "--server-base-path", EDITOR_BASE_PATH];
  const terms = ["--accept-server-license-terms", "--disable-telemetry"];
  return { bin: codePath, args: ["serve-web", ...listen, "--connection-token-file", tokenFile, ...terms] };
}

/**
 * Runs VS Code's web server for the Code view. If it dies it is started again, waiting longer each time
 * until it gets as far as ready.
 */
export class EditorServer implements Editor {
  private child?: EditorChild;
  private restart?: NodeJS.Timeout;
  private stopped = false;
  private current: EditorStateName = "starting";

  constructor(
    private command: EditorCommand,
    private launchProcess: LaunchEditor = launchInOwnGroup,
    private backoff: RestartBackoff = new CrashBackoff(),
  ) {}

  get status(): EditorStateName {
    return this.current;
  }

  start(): void {
    this.stopped = false;
    this.launch();
  }

  /** For good: it isn't started again. */
  stop(): void {
    this.stopped = true;
    clearTimeout(this.restart);
    if (this.child) stopGroup(this.child);
  }

  private launch(): void {
    this.current = "starting";
    const child = this.launchProcess(this.command);
    const kill = (): void => stopGroup(child);
    process.once("exit", kill); // the app crashing must not leave the editor's port taken
    child.on("error", (e) => console.error(`${LOG} ${errorMessage(e)}. ${SETUP_HINT}`));
    child.once("exit", (code) => {
      process.off("exit", kill);
      stopGroup(child); // what it started may outlive it
      this.exited(code);
    });
    if (child.stdout) createInterface({ input: child.stdout }).on("line", (line) => this.read(line));
    this.child = child;
  }

  private read(line: string): void {
    if (!line.includes(READY_LINE)) return;
    this.current = "ready";
    this.backoff.reset();
  }

  private exited(code: number | null): void {
    this.child = undefined;
    if (this.stopped) return;
    this.current = "failed";
    const delay = this.backoff.nextDelay();
    console.error(`${LOG} VS Code stopped (exit code ${String(code)}); starting it again in ${delay / SECOND_MS}s.`);
    this.restart = setTimeout(() => this.launch(), delay);
  }
}

/** Its own process group, so stopping the group stops the server it starts as well. */
function launchInOwnGroup({ bin, args }: EditorCommand): EditorChild {
  return spawn(bin, args, { stdio: ["ignore", "pipe", "inherit"], detached: true });
}

function stopGroup({ pid }: EditorChild): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // the group has already exited
  }
}
