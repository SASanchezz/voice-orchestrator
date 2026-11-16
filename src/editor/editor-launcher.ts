import { spawn, type ChildProcess } from "node:child_process";
import { errorMessage } from "../shared/errors.js";
import { KeptEditor, SpawnedEditor, type EditorProcess } from "./editor-process.js";
import type { EditorCommand, EditorProcesses } from "./editor-server.js";
import type { KeptEditorFile } from "./kept-editor-file.js";

const LOG = "[editor]";
const SETUP_HINT = "Install VS Code, or fix editor.codePath in config/config.yaml.";

export type SpawnEditor = (command: EditorCommand) => ChildProcess;

/** Starts the editor server, or carries on with the one kept running over the last restart. */
export class EditorLauncher implements EditorProcesses {
  constructor(
    private readonly kept: KeptEditorFile,
    private readonly spawnEditor: SpawnEditor = (command) => EditorLauncher.spawnInOwnGroup(command),
  ) {}

  start(command: EditorCommand): EditorProcess {
    if (this.kept.isRunning(command)) return new KeptEditor(this.kept.take(), command.port);
    this.kept.stopStale();
    return this.launch(command);
  }

  /** Leaves it running for the app's next start, with its terminals and what runs in them. */
  keep(editor: EditorProcess, command: EditorCommand): void {
    editor.release();
    if (editor.pid !== undefined) this.kept.save(editor.pid, command);
  }

  private launch(command: EditorCommand): EditorProcess {
    const child = this.spawnEditor(command);
    child.on("error", (e) => console.error(`${LOG} ${errorMessage(e)}. ${SETUP_HINT}`));
    return new SpawnedEditor(child, command.port);
  }

  /**
   * Its own process group, so stopping the group stops the server it starts as well, and a restart's exit doesn't.
   * Nothing is piped to the app: a server kept over a restart would die writing to a closed pipe.
   */
  private static spawnInOwnGroup({ bin, args }: EditorCommand): ChildProcess {
    return spawn(bin, args, { stdio: ["ignore", "ignore", "inherit"], detached: true });
  }
}
