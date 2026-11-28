/** Punctuation and spaces whisper puts around and between the phrases. */
const SEPARATORS = "[\\s,.!?…()-]*";
/**
 * What whisper writes for silence: its own markers, and the phrases it makes up from them ("Thank you. Thank you.")
 * because video subtitles taught it that quiet ends that way.
 */
const SILENCE_PHRASES = [
  "blank_audio",
  "silence",
  "music",
  "you",
  "thank you(?: very much| so much)?(?: for watching)?",
  "thanks for watching",
];
const ONLY_SILENCE_PHRASES = new RegExp(`^(?:${SEPARATORS}(?:${SILENCE_PHRASES.join("|")})${SEPARATORS})+$`, "i");

/** True when a transcript holds nothing but what whisper writes for silence, however many times over. */
export function meansNothingSaid(transcript: string): boolean {
  return ONLY_SILENCE_PHRASES.test(transcript);
}
