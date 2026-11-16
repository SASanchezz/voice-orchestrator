import { createInterface } from "node:readline";
import type { Readable } from "node:stream";

/** What a pop-up helper prints on your first click anywhere in it, before any answer. */
export const SEEN_LINE = "seen";

/** Passes on the pop-up's first click, then its one answer; nothing it prints after the answer. */
export function readPanelOutput(output: Readable, seen: () => void, answered: (answer: string) => void): void {
  createInterface({ input: output }).on("line", answerLines(seen, answered));
}

/** The same, line by line, for a reader that first takes the lines meant for something else. */
export function answerLines(seen: () => void, answered: (answer: string) => void): (line: string) => void {
  let isAnswered = false;
  return (line: string): void => {
    const printed = line.trim();
    if (isAnswered) return;
    if (printed === SEEN_LINE) return seen();
    isAnswered = true;
    answered(printed);
  };
}
