import { confirmWords } from "./confirm-request.js";

const PARAGRAPH_BREAK = /\n\s*\n/;

/**
 * The part of the assistant's reply worth showing on the confirm pop-up: its last paragraph that names one of the
 * asked confirm phrases, or else its last paragraph. A reply streamed in pieces can repeat itself or start with
 * stale news; the paragraph that asks for the phrase is the one that says what you're confirming.
 */
export function confirmSummary(reply: string, verbs: string[]): string {
  const paragraphs = reply
    .split(PARAGRAPH_BREAK)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return paragraphs.findLast(namesPhraseOf(verbs)) ?? paragraphs.at(-1) ?? "";
}

function namesPhraseOf(verbs: string[]): (paragraph: string) => boolean {
  const phrases = verbs.map(confirmWords);
  return (paragraph) => phrases.some((phrase) => paragraph.toLowerCase().includes(phrase));
}
