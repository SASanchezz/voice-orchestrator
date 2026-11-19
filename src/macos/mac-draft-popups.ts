import { spawn } from "node:child_process";
import type { DraftPopupAnswer, DraftPopupContent, DraftPopupDevice } from "../ui/draft-popups.js";
import type { OpenPanel } from "../ui/question-popups.js";
import { buildNativeHelper } from "./native-helper.js";
import { readPanelOutput } from "./panel-output.js";

const BUTTONS = ["--button", "later", "Later", "--button", "open", "Open"];

/** The small draft pop-up, from the same Swift helper as the other pop-ups: it never takes focus and makes no sound. */
export class MacDraftPopups implements DraftPopupDevice {
  private constructor(private helperPath: string) {}

  static async create(): Promise<MacDraftPopups> {
    return new MacDraftPopups(await buildNativeHelper("popup-panel"));
  }

  show({ title, preview }: DraftPopupContent, chosen: (answer: DraftPopupAnswer) => void): OpenPanel {
    const args = [title, "", "", "", ...BUTTONS, "--explanation", preview];
    const helper = spawn(this.helperPath, args, { stdio: ["pipe", "pipe", "inherit"] });
    helper.stdin.on("error", () => {}); // closed by a click or by itself
    readPanelOutput(
      helper.stdout,
      () => {},
      (answer) => chosen(answer === "open" ? "open" : "later"),
    );
    return { close: () => helper.kill() };
  }
}
