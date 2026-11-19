import type { EditorStateName } from "../ui/protocol.js";

/** VS Code for the web UI's Code view, run in the background while the app runs. */
export interface Editor {
  readonly status: EditorStateName;
  start(): void;
  stop(): void;
  /** For a restart: left running, so its terminals and the servers in them carry on, for the next start to take over. */
  keepRunning(): void;
}

/** The Code view's VS Code, which you can also restart from the web UI when it misbehaves. */
export interface RestartableEditor extends Editor {
  /** A new server in place of the running one; its terminals and what runs in them stop. */
  restart(): Promise<void>;
}

/** `editor.enabled` is off: there is no Code view. */
export class OffEditor implements RestartableEditor {
  readonly status = "off";

  start(): void {}

  stop(): void {}

  keepRunning(): void {}

  restart(): Promise<void> {
    return Promise.reject(new Error("The Code view is off: editor.enabled in config/config.yaml."));
  }
}
