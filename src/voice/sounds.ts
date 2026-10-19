import { spawn } from "node:child_process";

/** Recording started. */
export const START_SOUND = "Tink";
/** Recording ended and is being transcribed. */
export const END_SOUND = "Pop";
/** Your voice message was discarded; nothing is sent. */
export const DISCARD_SOUND = "Funk";

export function playSound(name: string): void {
  spawn("afplay", [`/System/Library/Sounds/${name}.aiff`], { stdio: "ignore" });
}
