/** Normalize a transcript: lowercase, letters/digits/spaces only. */
export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when the user said "confirm <verb>" in this utterance. A pause word may sit between the two
 * ("confirm, and push"); a negation before it ("don't confirm push") never counts.
 */
export function utteranceConfirms(utterance: string | undefined, verb: string): boolean {
  if (!utterance) return false;
  return confirmPhrase(verb).test(normalizeSpeech(utterance));
}

/** Normalized words are only letters, digits and single spaces, so the verb is safe inside the pattern. */
function confirmPhrase(verb: string): RegExp {
  return new RegExp(`(?<!\\b(?:not|never|dont|don t|do not) )\\bconfirm (?:and )?${normalizeSpeech(verb)}\\b`);
}
