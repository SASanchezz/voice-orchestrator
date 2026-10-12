import { spawn, type ChildProcessByStdio } from "node:child_process";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { Popup, PopupContent, PopupDevice } from "../ui/permission-popups.js";
import type { Notice, NoticeDevice } from "../ui/task-notices.js";
import { buildNativeHelper } from "./native-helper.js";

/** Long enough to notice from across the room; the page keeps its own pop-up until you've seen it. */
const NOTICE_SECONDS = 30;

type Panel = ChildProcessByStdio<Writable, Readable, null>;

/**
 * macOS pop-ups from a small Swift helper: a floating panel that never takes focus,
 * so the browser or whatever app you're in stays in front. One helper process per pop-up.
 */
export class MacPopups implements PopupDevice, NoticeDevice {
  private constructor(private helperPath: string) {}

  static async create(): Promise<MacPopups> {
    return new MacPopups(await buildNativeHelper("popup-panel"));
  }

  open(content: PopupContent, clicked: (allowed: boolean) => void): Popup {
    const { title, warning, command, allowLabel } = content;
    const panel = this.show([title, warning, command, allowLabel]);
    panel.stdin.on("error", () => {}); // the pop-up was clicked or closed before an explanation reached it
    createInterface({ input: panel.stdout }).once("line", (answer) => clicked(answer === "allow"));
    return {
      explain: (explanation) => panel.stdin.write(`${explanation.replace(/\s+/g, " ")}\n`),
      close: () => panel.kill(),
    };
  }

  /** In the bottom-right corner, clear of permission requests; closes by itself. */
  notify(notice: Notice, chosen: (answer: string) => void): void {
    const buttons = notice.buttons.flatMap(({ answer, label }) => ["--button", answer, label]);
    const options = [...buttons, "--bottom", "--close-after", String(NOTICE_SECONDS)];
    const panel = this.show([notice.title, "", "", "", ...options]);
    createInterface({ input: panel.stdout }).once("line", (line) => {
      const button = notice.buttons.find(({ answer }) => answer === line.trim()); // only answers it was given
      if (button) chosen(button.answer);
    });
  }

  private show(args: string[]): Panel {
    return spawn(this.helperPath, args, { stdio: ["pipe", "pipe", "inherit"] });
  }
}
