import { spawn } from "node:child_process";
import type { OpenPanel, QuestionPanel, QuestionPanelDevice } from "../ui/question-popups.js";
import { buildNativeHelper } from "./native-helper.js";
import { readPanelOutput } from "./panel-output.js";

const OTHER_ANSWER_PLACEHOLDER = "Or type your own answer";

/** Question pop-ups from the same Swift helper as permission pop-ups, with stacked buttons and a field for your words. */
export class MacQuestionPanels implements QuestionPanelDevice {
  private constructor(private helperPath: string) {}

  static async create(): Promise<MacQuestionPanels> {
    return new MacQuestionPanels(await buildNativeHelper("popup-panel"));
  }

  ask(panel: QuestionPanel, chosen: (answer: string) => void, seen: () => void): OpenPanel {
    const buttons = panel.buttons.flatMap(({ answer, label }) => ["--button", answer, label]);
    const text = panel.acceptsText ? ["--text", OTHER_ANSWER_PLACEHOLDER] : [];
    const args = [panel.title, "", panel.detail, "", ...buttons, ...text, "--stacked"];
    const helper = spawn(this.helperPath, args, { stdio: ["pipe", "pipe", "inherit"] });
    readPanelOutput(helper.stdout, seen, chosen);
    return { close: () => helper.kill() };
  }
}
