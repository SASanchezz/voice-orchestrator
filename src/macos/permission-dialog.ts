import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { Popup, PopupContent, PopupDevice } from "../ui/permission-popups.js";
import { buildNativeHelper } from "./native-helper.js";

/**
 * macOS pop-ups from a small Swift helper: a floating panel that never takes focus,
 * so the browser or whatever app you're in stays in front. One helper process per pop-up.
 */
export class MacPermissionDialogs implements PopupDevice {
  private constructor(private helperPath: string) {}

  static async create(): Promise<MacPermissionDialogs> {
    return new MacPermissionDialogs(await buildNativeHelper("permission-dialog"));
  }

  open(content: PopupContent, clicked: (allowed: boolean) => void): Popup {
    const { title, warning, command, allowLabel } = content;
    const helper = spawn(this.helperPath, [title, warning, command, allowLabel], {
      stdio: ["pipe", "pipe", "inherit"],
    });
    helper.stdin.on("error", () => {}); // the pop-up was clicked or closed before an explanation reached it
    createInterface({ input: helper.stdout }).once("line", (answer) => clicked(answer === "allow"));
    return {
      explain: (explanation) => helper.stdin.write(`${explanation.replace(/\s+/g, " ")}\n`),
      close: () => helper.kill(),
    };
  }
}
