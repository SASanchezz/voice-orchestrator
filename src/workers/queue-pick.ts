/** Which queued instruction is meant: its place (from 1), words from it, or both, to check it is still there. */
export interface QueuePick {
  place?: number;
  match?: string;
}

const PREVIEW_CHARS = 60;

/** The index (from 0) of the queued instruction the pick means; an error to read out if it means none or several. */
export function pickQueued(queued: string[], { place, match }: QueuePick): number {
  if (place !== undefined) return checkedPlace(queued, place, match);
  if (match?.trim()) return matchedIndex(queued, match);
  throw new Error("Say which queued task: its number or words from it.");
}

/** "#2 add rate limiting to the login…" */
export function queuedLine(instruction: string, index: number): string {
  const oneLine = instruction.replace(/\s+/g, " ").trim();
  const preview = oneLine.length > PREVIEW_CHARS ? `${oneLine.slice(0, PREVIEW_CHARS)}…` : oneLine;
  return `#${index + 1} ${preview}`;
}

function checkedPlace(queued: string[], place: number, match: string | undefined): number {
  const index = place - 1;
  const instruction = queued[index];
  if (instruction === undefined) throw new Error(`There is no #${place}; ${queued.length} queued.`);
  if (match && !mentions(instruction, match))
    throw new Error(`The queue changed: #${place} is now "${queuedLine(instruction, index)}". Nothing was removed.`);
  return index;
}

function matchedIndex(queued: string[], match: string): number {
  const indexes = queued.flatMap((instruction, index) => (mentions(instruction, match) ? [index] : []));
  if (indexes.length === 1) return indexes[0] ?? -1;
  if (!indexes.length) throw new Error(`No queued task mentions "${match}".`);
  const lines = indexes.map((index) => queuedLine(queued[index] ?? "", index)).join("; ");
  throw new Error(`Several queued tasks mention "${match}": ${lines}. Which one?`);
}

function mentions(instruction: string, match: string): boolean {
  return instruction.toLowerCase().includes(match.trim().toLowerCase());
}
