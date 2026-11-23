import { spawn } from "node:child_process";
import { buildNativeHelper } from "./native-helper.js";

/**
 * The quick panel from a Swift helper: brought up from any app by a key combo, it shows the web UI's quick page for
 * writing to a session or the assistant. One helper for the whole run; the page's link (it carries the UI token) goes
 * through its stdin, so no other process can read it off a command line. It quits when the app does.
 */
export class MacQuickPanel {
  private constructor(private helperPath: string) {}

  static async create(): Promise<MacQuickPanel> {
    return new MacQuickPanel(await buildNativeHelper("quick-panel"));
  }

  /** `hotkey` was checked by the config's schema, e.g. "ctrl+option+space". */
  start(link: string, hotkey: string): void {
    const helper = spawn(this.helperPath, [], { stdio: ["pipe", "ignore", "inherit"] });
    helper.stdin.on("error", () => {}); // it quit; its stderr already said why
    helper.stdin.write(`load ${link}\nhotkey ${hotkey}\n`);
  }
}
