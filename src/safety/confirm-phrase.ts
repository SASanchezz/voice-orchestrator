/** Normalize a transcript: lowercase, letters/digits/spaces only. */
export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the user literally said "confirm <verb>" in this utterance. */
export function utteranceConfirms(utterance: string | undefined, verb: string): boolean {
  if (!utterance) return false;
  return ` ${normalizeSpeech(utterance)} `.includes(` confirm ${normalizeSpeech(verb)} `);
}
