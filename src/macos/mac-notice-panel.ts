import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Writable } from "node:stream";
import type { NoticePanelDevice } from "../ui/notices/task-notices.js";
import { buildNativeHelper } from "./native-helper.js";

type Helper = ChildProcessByStdio<Writable, null, null>;

/**
 * The notice panel from a Swift helper: one floating panel in the bottom-right corner showing the web UI's notice page.
 * One helper for the whole run, started with the first notice; the page's link (it carries the UI token) goes through
 * its stdin, so no other process can read it off a command line.
 */
export class MacNoticePanel implements NoticePanelDevice {
  private helper?: Helper;

  private constructor(private helperPath: string) {}

  static async create(): Promise<MacNoticePanel> {
    return new MacNoticePanel(await buildNativeHelper("notice-panel"));
  }

  show(link: string): void {
    this.helperShowing(link).stdin.write("show\n");
  }

  hide(): void {
    this.helper?.stdin.write("hide\n");
  }

  /** The running helper, started on `link` if it isn't running; one that quit is started again. */
  private helperShowing(link: string): Helper {
    if (this.helper) return this.helper;
    const helper = spawn(this.helperPath, [], { stdio: ["pipe", "ignore", "inherit"] });
    helper.stdin.on("error", () => {}); // it quit; the next notice starts it again
    helper.once("exit", () => (this.helper = undefined));
    helper.stdin.write(`load ${link}\n`);
    this.helper = helper;
    return helper;
  }
}
