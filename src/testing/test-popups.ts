import type { Popup, PopupContent, PopupDevice } from "../ui/permission-popups.js";

/** A fake pop-up as a test sees it: what it shows, whether it is still open, and its buttons. */
export interface TestPopup {
  content: PopupContent;
  explanation?: string;
  closed: boolean;
  click(allowed: boolean): void;
}

/** Fake pop-ups: tests read what is shown and click its buttons. */
export class TestPopups implements PopupDevice {
  shown: TestPopup[] = [];

  open(content: PopupContent, clicked: (allowed: boolean) => void): Popup {
    const popup: TestPopup = { content, closed: false, click: clicked };
    this.shown.push(popup);
    return {
      explain: (explanation) => (popup.explanation = explanation),
      close: () => (popup.closed = true),
    };
  }

  /** The last pop-up opened. */
  latest(): TestPopup {
    const popup = this.shown.at(-1);
    if (!popup) throw new Error("No pop-up was opened.");
    return popup;
  }
}
