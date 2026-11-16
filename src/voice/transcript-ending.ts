/** Punctuation and spaces whisper puts around and between words. */
const BETWEEN_WORDS = "[\\s,.!?;:-]*";
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const LEFT_OVER_PUNCTUATION = /[\s,;:-]+$/;

/**
 * `transcript` without `ending` at its very end, whatever its case and punctuation: "Run the tests. Oracle." without
 * "oracle" is "Run the tests.". A transcript that doesn't end with it is returned as it is.
 */
export function withoutEnding(transcript: string, ending: string): string {
  const words = ending.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return transcript;
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${words.map(escapeRegex).join(BETWEEN_WORDS)}${BETWEEN_WORDS}$`, "iu");
  const match = pattern.exec(transcript);
  if (!match) return transcript;
  const kept = transcript.slice(0, match.index + match[1].length);
  return kept.replace(LEFT_OVER_PUNCTUATION, "").trim();
}

function escapeRegex(word: string): string {
  return word.replace(REGEX_SPECIAL, "\\$&");
}
