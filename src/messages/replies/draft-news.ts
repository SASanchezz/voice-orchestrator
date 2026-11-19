import type { Draft } from "./draft-store.js";
import type { DraftFiling } from "./reply-desk.js";

export type DraftListener = (draft: Draft) => void;

/** Files each new draft, then tells whoever follows that a reply is ready, e.g. the small pop-up. */
export class DraftNews implements DraftFiling {
  private listeners: DraftListener[] = [];

  constructor(private filing: DraftFiling) {}

  follow(listener: DraftListener): void {
    this.listeners.push(listener);
  }

  async file(draft: Draft): Promise<void> {
    await this.filing.file(draft);
    if (draft.status === "ready") this.listeners.forEach((listener) => listener(draft));
  }
}
