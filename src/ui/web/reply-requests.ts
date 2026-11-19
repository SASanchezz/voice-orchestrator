// A drafted reply's requests to the server: its buttons, and marking what its box shows for "confirm send".

import { post } from "./api.js";

const MARK_AFTER_TYPING_MS = 600;

export class ReplyRequests {
  private markTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private id: string,
    private status: HTMLElement,
    private done: (message: string) => void,
  ) {}

  /** A button's action; a refusal is shown on the card, never thrown. True when the server took it. */
  async run(action: "edit" | "send" | "dismiss", body: object): Promise<boolean> {
    this.status.textContent = "…";
    try {
      const message = (await post(this.path(action), body)) ?? "";
      this.status.textContent = "";
      this.done(message);
      return true;
    } catch (error) {
      this.status.textContent = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  /** Marks this text for "confirm send"; failing quietly only means the phrase finds nothing to send. */
  markForVoice(text: string): void {
    clearTimeout(this.markTimer);
    if (text) void post(this.path("arm"), { text }).catch(() => undefined);
  }

  /** While you type, the latest text is marked once you pause. */
  markWhenPaused(text: () => string): void {
    clearTimeout(this.markTimer);
    this.markTimer = setTimeout(() => this.markForVoice(text()), MARK_AFTER_TYPING_MS);
  }

  private path(action: string): string {
    return `/api/replies/${encodeURIComponent(this.id)}/${action}`;
  }
}
