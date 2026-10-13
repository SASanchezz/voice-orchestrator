import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { OpenPanel, QuestionPanel, QuestionPanelDevice } from "../ui/question-popups.js";
import { buildNativeHelper } from "./native-helper.js";

const OTHER_ANSWER_PLACEHOLDER = "Or type your own answer";

/** Question pop-ups from the same Swift helper as permission pop-ups, with stacked buttons and a field for your words. */
export class MacQuestionPanels implements QuestionPanelDevice {
  private constructor(private helperPath: string) {}

  static async create(): Promise<MacQuestionPanels> {
    return new MacQuestionPanels(await buildNativeHelper("popup-panel"));
  }

  ask(panel: QuestionPanel, chosen: (answer: string) => void): OpenPanel {
    const buttons = panel.buttons.flatMap(({ answer, label }) => ["--button", answer, label]);
    const text = panel.acceptsText ? ["--text", OTHER_ANSWER_PLACEHOLDER] : [];
    const args = [panel.title, "", panel.detail, "", ...buttons, ...text, "--stacked"];
    const helper = spawn(this.helperPath, args, { stdio: ["pipe", "pipe", "inherit"] });
    createInterface({ input: helper.stdout }).once("line", (line) => chosen(line.trim()));
    return { close: () => helper.kill() };
  }
}
