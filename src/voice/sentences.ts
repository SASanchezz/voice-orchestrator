const SENTENCE_END = /(?<=[.!?…])\s+/;

/** Splits speech into sentences, so the first one can play while the rest are still being turned into audio. */
export function splitSentences(text: string): string[] {
  return text.split(SENTENCE_END).filter(isWorded);
}

function isWorded(sentence: string): boolean {
  return sentence.trim() !== "";
}
