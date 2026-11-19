import type { DraftPopupAnswer, DraftPopupContent, DraftPopupDevice } from "../ui/draft-popups.js";
import type { OpenPanel } from "../ui/question-popups.js";

/** A fake draft pop-up as a test sees it: what it says, whether it is open, and its buttons. */
export interface TestDraftPopup {
  content: DraftPopupContent;
  closed: boolean;
  choose(answer: DraftPopupAnswer): void;
}

/** Fake draft pop-ups: tests read what is shown and click Open or Later. */
export class TestDraftPopups implements DraftPopupDevice {
  shown: TestDraftPopup[] = [];

  show(content: DraftPopupContent, chosen: (answer: DraftPopupAnswer) => void): OpenPanel {
    const popup: TestDraftPopup = { content, closed: false, choose: chosen };
    this.shown.push(popup);
    return { close: () => (popup.closed = true) };
  }
}
