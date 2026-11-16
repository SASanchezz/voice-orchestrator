import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import type { Popup, PopupContent, PopupDevice } from "../ui/permission-popups.js";
import { buildNativeHelper } from "./native-helper.js";
import { readPanelOutput } from "./panel-output.js";

type Panel = ChildProcessByStdio<Writable, Readable, null>;

/**
 * macOS pop-ups from a small Swift helper: a floating panel that never takes focus,
 * so the browser or whatever app you're in stays in front. One helper process per pop-up.
 */
export class MacPopups implements PopupDevice {
  private constructor(private helperPath: string) {}

  static async create(): Promise<MacPopups> {
    return new MacPopups(await buildNativeHelper("popup-panel"));
  }

  open(content: PopupContent, clicked: (allowed: boolean) => void, seen: () => void): Popup {
    const { title, warning, command, wholeCommand, allowLabel } = content;
    const whole = wholeCommand ? ["--whole-detail", wholeCommand] : [];
    const panel = this.show([title, warning, command, allowLabel, ...whole]);
    panel.stdin.on("error", () => {}); // the pop-up was clicked or closed before an explanation reached it
    readPanelOutput(panel.stdout, seen, (answer) => clicked(answer === "allow"));
    return {
      explain: (explanation) => panel.stdin.write(`${explanation.replace(/\s+/g, " ")}\n`),
      close: () => panel.kill(),
    };
  }

  private show(args: string[]): Panel {
    return spawn(this.helperPath, args, { stdio: ["pipe", "pipe", "inherit"] });
  }
}
