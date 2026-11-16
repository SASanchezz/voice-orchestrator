import type { ConfirmPanel } from "../ui/confirm-popups.js";
import type { OpenPanel, QuestionPanel, QuestionPanelEvents } from "../ui/question-popups.js";
import type { VoiceListener } from "../ui/voice-box/voice-box.js";
import type { VoiceBoxEvent } from "../ui/voice-box-protocol.js";

/** A fake pop-up as a test sees it: what it shows, whether it is still open, and a way to answer it. */
export interface TestPanel<Panel> {
  panel: Panel;
  closed: boolean;
  /** What it was told about the recording its field follows. */
  told: VoiceBoxEvent[];
  choose(answer: string): void;
  /** A click anywhere in it, off its buttons. */
  clickInside(): void;
}

/** Fake pop-ups with buttons: tests read what is shown and click a button or type an answer. */
class TestPanels<Panel> {
  shown: TestPanel<Panel>[] = [];

  protected show(panel: Panel, chosen: (answer: string) => void, seen: () => void): OpenPanel & VoiceListener {
    const shown: TestPanel<Panel> = { panel, closed: false, told: [], choose: chosen, clickInside: seen };
    this.shown.push(shown);
    return { close: () => (shown.closed = true), tell: (event) => void shown.told.push(event) };
  }

  /** The last pop-up opened. */
  latest(): TestPanel<Panel> {
    const shown = this.shown.at(-1);
    if (!shown) throw new Error("No pop-up was opened.");
    return shown;
  }
}

/** Fake pop-ups for a worker's questions. */
export class TestQuestionPanels extends TestPanels<QuestionPanel> {
  ask(panel: QuestionPanel, events: QuestionPanelEvents): OpenPanel & VoiceListener {
    return this.show(
      panel,
      (answer) => events.chosen(answer),
      () => events.seen(),
    );
  }
}

/** Fake pop-ups for the assistant's confirm phrases. */
export class TestConfirmPanels extends TestPanels<ConfirmPanel> {
  ask(panel: ConfirmPanel, chosen: (answer: string) => void, seen: () => void): OpenPanel {
    return this.show(panel, chosen, seen);
  }
}
