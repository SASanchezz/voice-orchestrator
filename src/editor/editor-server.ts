import type { EditorSettings } from "../config/editor-config.js";
import { CrashBackoff } from "../orchestrator/model/crash-backoff.js";
import type { EditorStateName } from "../ui/protocol.js";
import type { Editor } from "./editor.js";
import type { EditorProcess } from "./editor-process.js";
import { EDITOR_BASE_PATH } from "./editor-url.js";

const LOG = "[editor]";
const SECOND_MS = 1000;

/** How the editor server is started: the VS Code CLI, what follows it, and the port it listens on. */
export interface EditorCommand {
  bin: string;
  args: string[];
  port: number;
}

/** Where the editor's process comes from, and where it goes when the app restarts. */
export interface EditorProcesses {
  start(command: EditorCommand): EditorProcess;
  keep(editor: EditorProcess, command: EditorCommand): void;
}

export type RestartBackoff = Pick<CrashBackoff, "nextDelay" | "reset">;

/** `code serve-web` on 127.0.0.1, under the editor's base path, with the web UI's token as its connection token. */
export function editorCommand({ codePath, port }: EditorSettings, tokenFile: string): EditorCommand {
  const listen = ["--host", "127.0.0.1", "--port", String(port), "--server-base-path", EDITOR_BASE_PATH];
  const terms = ["--accept-server-license-terms", "--disable-telemetry"];
  return { bin: codePath, args: ["serve-web", ...listen, "--connection-token-file", tokenFile, ...terms], port };
}

/**
 * Runs VS Code's web server for the Code view. If it dies it is started again, waiting longer each time
 * until it gets as far as ready.
 */
export class EditorServer implements Editor {
  private running?: EditorProcess;
  private restart?: NodeJS.Timeout;
  private stopped = false;
  private current: EditorStateName = "starting";

  constructor(
    private readonly command: EditorCommand,
    private readonly processes: EditorProcesses,
    private readonly backoff: RestartBackoff = new CrashBackoff(),
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
    this.stopWatching();
    this.running?.stop();
    this.running = undefined;
  }

  keepRunning(): void {
    this.stopWatching();
    if (this.running) this.processes.keep(this.running, this.command);
    this.running = undefined;
  }

  private stopWatching(): void {
    this.stopped = true;
    clearTimeout(this.restart);
  }

  private launch(): void {
    this.current = "starting";
    const editor = this.processes.start(this.command);
    editor.onExit((code) => this.exited(editor, code));
    void editor.ready.then(() => this.becameReady(editor));
    this.running = editor;
  }

  private becameReady(editor: EditorProcess): void {
    if (editor !== this.running) return;
    this.current = "ready";
    this.backoff.reset();
  }

  private exited(editor: EditorProcess, code: number | null): void {
    if (editor !== this.running) return;
    this.running = undefined;
    if (this.stopped) return;
    this.current = "failed";
    const delay = this.backoff.nextDelay();
    console.error(`${LOG} VS Code stopped (exit code ${String(code)}); starting it again in ${delay / SECOND_MS}s.`);
    this.restart = setTimeout(() => this.launch(), delay);
  }
}
