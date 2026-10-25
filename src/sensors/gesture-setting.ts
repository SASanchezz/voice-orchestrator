import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

export const GESTURE_MODES = ["on", "off"] as const;
export type GestureMode = (typeof GESTURE_MODES)[number];

const settingSchema = z.object({ mode: z.enum(GESTURE_MODES) });

/** Whether camera gestures are on, as last switched in the web UI; until then, as config.yaml says. */
export class GestureSetting {
  constructor(
    private file: string,
    private fallback: GestureMode,
  ) {}

  read(): GestureMode {
    if (!existsSync(this.file)) return this.fallback;
    const saved: unknown = JSON.parse(readFileSync(this.file, "utf8"));
    return settingSchema.parse(saved).mode;
  }

  remember(mode: GestureMode): void {
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, `${JSON.stringify({ mode }, null, 2)}\n`);
  }
}
