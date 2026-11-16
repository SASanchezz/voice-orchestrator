import { spawn } from "node:child_process";
import type { ConfirmPanel, ConfirmPanelDevice } from "../ui/confirm-popups.js";
import type { OpenPanel } from "../ui/question-popups.js";
import { buildNativeHelper } from "./native-helper.js";
import { readPanelOutput } from "./panel-output.js";

/** Confirm pop-ups from the same Swift helper as permission pop-ups, in the same layout: buttons side by side. */
export class MacConfirmPanels implements ConfirmPanelDevice {
  private constructor(private helperPath: string) {}

  static async create(): Promise<MacConfirmPanels> {
    return new MacConfirmPanels(await buildNativeHelper("popup-panel"));
  }

  ask(panel: ConfirmPanel, chosen: (answer: string) => void, seen: () => void): OpenPanel {
    const buttons = panel.buttons.flatMap(({ answer, label }) => ["--button", answer, label]);
    const args = [panel.title, panel.warning, "", "", ...buttons, "--explanation", panel.summary];
    const helper = spawn(this.helperPath, args, { stdio: ["pipe", "pipe", "inherit"] });
    readPanelOutput(helper.stdout, seen, chosen);
    return { close: () => helper.kill() };
  }
}
