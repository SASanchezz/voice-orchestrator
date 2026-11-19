import type { DraftNews } from "../messages/replies/draft-news.js";
import type { Draft } from "../messages/replies/draft-store.js";
import type { RuleLookup } from "../messages/replies/reply-inbox.js";
import type { OpenPanel } from "./question-popups.js";

/** A pop-up that closes by itself after this long, so it never piles up while you're away. */
export const DRAFT_POPUP_MS = 15_000;
const PREVIEW_CHARS = 140;

/** What the small pop-up says: who the reply is for, and the start of it. */
export interface DraftPopupContent {
  title: string;
  preview: string;
}

/** open: show the draft in the web UI; later: leave it in the Messages view. */
export type DraftPopupAnswer = "open" | "later";

export interface DraftPopupDevice {
  show(content: DraftPopupContent, chosen: (answer: DraftPopupAnswer) => void): OpenPanel;
}

/**
 * A small, silent pop-up for each new draft, over any app and without taking focus: nothing is said aloud. Open takes
 * the web UI to the draft; the pop-up closes by itself after a while. A chat whose rule says no alert gets none.
 */
export class DraftPopups {
  constructor(
    private device: DraftPopupDevice,
    private openDraft: (draftId: string) => Promise<void>,
    private rules: RuleLookup,
  ) {}

  follow(news: DraftNews): void {
    news.follow((draft) => this.showUnlessQuiet(draft));
  }

  private showUnlessQuiet(draft: Draft): void {
    if (this.isQuiet(draft)) return;
    const panel = this.device.show(DraftPopups.contentOf(draft), (answer) => this.chosen(draft, answer, panel));
    setTimeout(() => panel.close(), DRAFT_POPUP_MS).unref();
  }

  /** A rules file that can't be read is said elsewhere; the pop-up still shows, as no alert is the exception. */
  private isQuiet(draft: Draft): boolean {
    try {
      return this.rules.ruleFor(draft).alert === "none";
    } catch {
      return false;
    }
  }

  private chosen(draft: Draft, answer: DraftPopupAnswer, panel: OpenPanel): void {
    panel.close();
    if (answer === "open") void this.openDraft(draft.id);
  }

  private static contentOf({ from, source, chatName, chatKind, text }: Draft): DraftPopupContent {
    const where = chatKind === "dm" ? source : `${chatName} · ${source}`;
    const draftText = text ?? "";
    const preview = draftText.length > PREVIEW_CHARS ? `${draftText.slice(0, PREVIEW_CHARS)}…` : draftText;
    return { title: `Reply to ${from} · ${where}`, preview };
  }
}
