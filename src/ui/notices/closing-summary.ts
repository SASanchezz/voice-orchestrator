/** A note this short is read whole: there is nothing to fold away. */
const SHORT_NOTE_CHARS = 400;
const PARAGRAPH_BREAK = /\n\s*\n/;
const CODE_FENCE = /^\s*(```|~~~)/m;

/**
 * The plain-language summary a worker is asked to end its closing note with: the note's last paragraph of prose.
 * A short note is all summary.
 */
export function closingSummary(note: string): string {
  const whole = note.trim();
  if (whole.length <= SHORT_NOTE_CHARS) return whole;
  return whole.split(PARAGRAPH_BREAK).findLast(isProse)?.trim() ?? whole;
}

/** Text worth reading on its own: not a piece of a code block, which blank lines inside it would split apart. */
function isProse(paragraph: string): boolean {
  return paragraph.trim() !== "" && !CODE_FENCE.test(paragraph);
}
