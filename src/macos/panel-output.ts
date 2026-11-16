import { createInterface } from "node:readline";
import type { Readable } from "node:stream";

/** What a pop-up helper prints on your first click anywhere in it, before any answer. */
export const SEEN_LINE = "seen";

/** Passes on the pop-up's first click, then its one answer; nothing it prints after the answer. */
export function readPanelOutput(output: Readable, seen: () => void, answered: (answer: string) => void): void {
  let isAnswered = false;
  const onLine = (line: string): void => {
    const printed = line.trim();
    if (isAnswered) return;
    if (printed === SEEN_LINE) return seen();
    isAnswered = true;
    answered(printed);
  };
  createInterface({ input: output }).on("line", onLine);
}
