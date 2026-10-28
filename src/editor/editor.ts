import type { EditorStateName } from "../ui/protocol.js";

/** VS Code for the web UI's Code view, run in the background while the app runs. */
export interface Editor {
  readonly status: EditorStateName;
  start(): void;
  stop(): void;
}

/** `editor.enabled` is off: there is no Code view. */
export class OffEditor implements Editor {
  readonly status = "off";

  start(): void {}

  stop(): void {}
}
