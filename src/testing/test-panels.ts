import type { ConfirmPanel } from "../ui/confirm-popups.js";
import type { OpenPanel, QuestionPanel } from "../ui/question-popups.js";

/** A fake pop-up as a test sees it: what it shows, whether it is still open, and a way to answer it. */
export interface TestPanel<Panel> {
  panel: Panel;
  closed: boolean;
  choose(answer: string): void;
}

/** Fake pop-ups with buttons: tests read what is shown and click a button or type an answer. */
class TestPanels<Panel> {
  shown: TestPanel<Panel>[] = [];

  ask(panel: Panel, chosen: (answer: string) => void): OpenPanel {
    const shown: TestPanel<Panel> = { panel, closed: false, choose: chosen };
    this.shown.push(shown);
    return { close: () => (shown.closed = true) };
  }

  /** The last pop-up opened. */
  latest(): TestPanel<Panel> {
    const shown = this.shown.at(-1);
    if (!shown) throw new Error("No pop-up was opened.");
    return shown;
  }
}

/** Fake pop-ups for a worker's questions. */
export class TestQuestionPanels extends TestPanels<QuestionPanel> {}

/** Fake pop-ups for the assistant's confirm phrases. */
export class TestConfirmPanels extends TestPanels<ConfirmPanel> {}
