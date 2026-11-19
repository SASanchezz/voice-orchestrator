import { hideSecrets } from "../hidden-secrets.js";
import { INVISIBLE } from "../sanitize.js";

const LINE_BREAK = /\r\n|[\r\n\u2028\u2029]/;

/**
 * A message as it is shown and made into a task: its lines kept, but characters you can't see taken out so the text
 * holds nothing hidden from you, and secrets hidden.
 */
export function visibleText(text: string): string {
  const lines = text.split(LINE_BREAK).map((line) => line.replace(INVISIBLE, ""));
  return hideSecrets(lines.join("\n")).trim();
}
