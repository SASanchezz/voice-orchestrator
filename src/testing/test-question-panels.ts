import type { OpenPanel, QuestionPanel, QuestionPanelDevice } from "../ui/question-popups.js";

/** A fake question pop-up as a test sees it: what it shows, whether it is still open, and a way to answer it. */
export interface TestQuestionPanel {
  panel: QuestionPanel;
  closed: boolean;
  choose(answer: string): void;
}

/** Fake question pop-ups: tests read what is shown and click a button or type an answer. */
export class TestQuestionPanels implements QuestionPanelDevice {
  shown: TestQuestionPanel[] = [];

  ask(panel: QuestionPanel, chosen: (answer: string) => void): OpenPanel {
    const shown: TestQuestionPanel = { panel, closed: false, choose: chosen };
    this.shown.push(shown);
    return { close: () => (shown.closed = true) };
  }

  /** The last pop-up opened. */
  latest(): TestQuestionPanel {
    const shown = this.shown.at(-1);
    if (!shown) throw new Error("No question pop-up was opened.");
    return shown;
  }
}
