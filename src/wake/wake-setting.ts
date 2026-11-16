import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

export const WAKE_WORD_MODES = ["on", "off"] as const;
export type WakeWordMode = (typeof WAKE_WORD_MODES)[number];

/** Until you first switch it, the wake word is on. */
const DEFAULT_MODE: WakeWordMode = "on";

const settingSchema = z.object({ mode: z.enum(WAKE_WORD_MODES) });

/** Whether the wake word is on, as last switched in the web UI (state/wake-word.json). */
export class WakeWordSetting {
  constructor(private file: string) {}

  read(): WakeWordMode {
    if (!existsSync(this.file)) return DEFAULT_MODE;
    const saved: unknown = JSON.parse(readFileSync(this.file, "utf8"));
    return settingSchema.parse(saved).mode;
  }

  remember(mode: WakeWordMode): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, `${JSON.stringify({ mode }, null, 2)}\n`);
  }
}
