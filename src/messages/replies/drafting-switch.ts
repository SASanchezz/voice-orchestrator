import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import type { DraftRequests, MessageBurst } from "./reply-inbox.js";

const switchFileSchema = z.object({ on: z.boolean() });

/**
 * state/messages/drafting.json: whether new messages get drafted replies. On until you turn it off; it stays as you
 * left it across restarts. A damaged file reads as off, so nothing is drafted against your wish.
 */
export class DraftingSwitch {
  constructor(private file: string) {}

  isOn(): boolean {
    if (!existsSync(this.file)) return true;
    try {
      return switchFileSchema.parse(JSON.parse(readFileSync(this.file, "utf8"))).on;
    } catch {
      return false;
    }
  }

  turnOn(): void {
    this.write(true);
  }

  turnOff(): void {
    this.write(false);
  }

  private write(on: boolean): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    writeFileSync(temporary, `${JSON.stringify({ on }, null, 2)}\n`);
    renameSync(temporary, this.file);
  }
}

/** Passes a finished burst on to be drafted only while drafting is on; read when the burst ends. */
export class SwitchedDraftRequests implements DraftRequests {
  constructor(
    private drafting: DraftingSwitch,
    private drafts: DraftRequests,
  ) {}

  requested(burst: MessageBurst): void {
    if (this.drafting.isOn()) return this.drafts.requested(burst);
    console.info(`[replies] drafting is off: no draft for ${burst.messages[0]?.from ?? "a message"}`);
  }
}
