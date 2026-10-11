import { spawn } from "node:child_process";

/** Recording started. */
export const START_SOUND = "Tink";
/** Recording ended and is being transcribed. */
export const END_SOUND = "Pop";
/** Recording abandoned; nothing sent. */
export const FAILURE_SOUND = "Basso";

export function playSound(name: string): void {
  spawn("afplay", [`/System/Library/Sounds/${name}.aiff`], { stdio: "ignore" });
}
