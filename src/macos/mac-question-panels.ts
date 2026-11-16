import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { QuestionPanel, QuestionPanelEvents } from "../ui/question-popups.js";
import type { VoicedQuestionPanelDevice } from "../ui/voice-box/voiced-question-panels.js";
import type { OpenPanel } from "../ui/question-popups.js";
import type { PanelVoiceEvents, VoiceListener } from "../ui/voice-box/voice-box.js";
import { buildNativeHelper } from "./native-helper.js";
import { answerLines } from "./panel-output.js";
import { passOnVoiced, voiceCommandLine } from "./panel-voice.js";

const OTHER_ANSWER_PLACEHOLDER = "Or type your own answer";

/**
 * Question pop-ups from the same Swift helper as permission pop-ups, with stacked buttons and a field for your words,
 * which your spoken words can fill too.
 */
export class MacQuestionPanels implements VoicedQuestionPanelDevice {
  private constructor(private helperPath: string) {}

  static async create(): Promise<MacQuestionPanels> {
    return new MacQuestionPanels(await buildNativeHelper("popup-panel"));
  }

  ask(panel: QuestionPanel, events: QuestionPanelEvents & PanelVoiceEvents): OpenPanel & VoiceListener {
    const buttons = panel.buttons.flatMap(({ answer, label }) => ["--button", answer, label]);
    const text = panel.acceptsText ? ["--text", OTHER_ANSWER_PLACEHOLDER] : [];
    const args = [panel.title, "", panel.detail, "", ...buttons, ...text, "--stacked"];
    const helper = spawn(this.helperPath, args, { stdio: ["pipe", "pipe", "inherit"] });
    helper.stdin.on("error", () => {}); // it already closed, answered
    const answered = answerLines(
      () => events.seen(),
      (answer) => events.chosen(answer),
    );
    createInterface({ input: helper.stdout }).on("line", (line) => passOnVoiced(line, events, answered));
    return { close: () => helper.kill(), tell: (event) => void helper.stdin.write(voiceCommandLine(event)) };
  }
}
