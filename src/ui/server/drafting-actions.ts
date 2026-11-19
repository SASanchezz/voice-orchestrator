import { z } from "zod";
import type { DraftingSwitch } from "../../messages/replies/drafting-switch.js";

const draftingBody = z.object({ on: z.boolean() });

/** The Messages view's Drafting switch: whether new Slack and Telegram messages get drafted replies. */
export class DraftingActions {
  constructor(private drafting: DraftingSwitch) {}

  change(body: unknown): string {
    if (draftingBody.parse(body).on) return this.turnOn();
    return this.turnOff();
  }

  private turnOn(): string {
    this.drafting.turnOn();
    return "Drafting is on: new messages get drafted replies.";
  }

  private turnOff(): string {
    this.drafting.turnOff();
    return "Drafting is off: new messages get no drafts until you turn it back on.";
  }
}
